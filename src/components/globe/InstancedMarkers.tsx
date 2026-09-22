'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { latLngToVector3, orientedMatrix } from '@/lib/utils/geo';

/**
 * The single marker renderer used by every globe layer.
 *
 * Why instanced meshes: a busy day produces ~40 earthquakes plus ~120 natural
 * events plus hundreds of aircraft. One mesh per marker would mean hundreds of
 * draw calls and hundreds of React elements; this renders any number of markers
 * as one (dots) plus one (halos) plus optionally one (aircraft) draw call.
 *
 * Per-marker variation (position, size, colour, heading) lives in the instance
 * buffers, which are rebuilt only when the data or the highlight state changes —
 * never per frame. The only animated value is a single shared uniform, so
 * pulsing costs nothing per marker.
 */

export type MarkerShape = 'sphere' | 'halo' | 'plane';

export interface MarkerPoint {
  id: string;
  lat: number;
  lon: number;
  color: string;
  /** Relative size multiplier, typically derived from magnitude/severity. */
  scale: number;
  /** Degrees clockwise from north — only meaningful for `plane`. */
  heading?: number;
  /** Extra lift above the surface, in globe radii. */
  lift?: number;
}

interface InstancedMarkersProps {
  points: MarkerPoint[];
  shape?: MarkerShape;
  /** Base radius in globe radii; multiplied by `point.scale`. */
  baseScale?: number;
  /** Default distance above the surface (globe radii). */
  lift?: number;
  /** Breathing animation on the shared material opacity. */
  pulse?: boolean;
  /** Emissive intensity baked into the shader. */
  intensity?: number;
  opacity?: number;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  renderOrder?: number;
  selectedId?: string | null;
  hoveredId?: string | null;
}

/** Declared in every vertex shader below; consumed by the dot shader. */
const COMMON_ATTRIBUTES = /* glsl */ `
  attribute vec3 instanceColor;
  attribute float instanceScale;
`;

const DOT_VERTEX = /* glsl */ `
  ${COMMON_ATTRIBUTES}
  varying vec3 vInstanceColor;
  varying vec3 vNormalWorld;
  varying vec3 vWorldPosition;

  void main() {
    vInstanceColor = instanceColor;
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const DOT_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uIntensity;
  uniform float uHighlightBoost;
  varying vec3 vInstanceColor;
  varying vec3 vNormalWorld;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    // Fading the camera-away side keeps the globe's limb occlusion readable.
    float facing = clamp(dot(normalize(vNormalWorld), viewDirection), 0.0, 1.0);
    float diffuse = 0.55 + 0.45 * facing;
    float rim = pow(1.0 - facing, 2.0);
    vec3 color = vInstanceColor * (diffuse * uIntensity) + vec3(rim * 0.55) * vInstanceColor;
    gl_FragColor = vec4(color * uHighlightBoost, uOpacity);
  }
`;

const HALO_VERTEX = /* glsl */ `
  ${COMMON_ATTRIBUTES}
  varying vec3 vInstanceColor;
  varying vec2 vUv;

  void main() {
    vInstanceColor = instanceColor;
    vUv = uv;
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const HALO_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  uniform float uThickness;
  varying vec3 vInstanceColor;
  varying vec2 vUv;

  void main() {
    // Ring drawn in UV space on a quad: cheaper than a torus and it antialiases
    // better because the mask is computed per fragment.
    float dist = length(vUv - vec2(0.5)) * 2.0;
    float band = smoothstep(uThickness, uThickness * 0.5, dist) * smoothstep(uThickness * 0.55, uThickness * 0.98, dist);
    if (band <= 0.002) discard;
    gl_FragColor = vec4(vInstanceColor, band * uOpacity);
  }
`;

const PLANE_VERTEX = /* glsl */ `
  ${COMMON_ATTRIBUTES}
  varying vec3 vInstanceColor;
  varying vec2 vUv;

  void main() {
    vInstanceColor = instanceColor;
    vUv = uv;
    vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const PLANE_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vInstanceColor;
  varying vec2 vUv;

  void main() {
    // Chevron: a wide body tapering to a nose, so heading is legible at a glance.
    float body = 1.0 - smoothstep(0.16, 0.5, abs(vUv.x - 0.5) * 2.4);
    float taper = smoothstep(0.0, 0.42, vUv.y);
    float mask = body * taper;
    if (mask <= 0.01) discard;
    gl_FragColor = vec4(vInstanceColor * (0.72 + 0.28 * mask), mask * uOpacity);
  }
`;

export function InstancedMarkers({
  points,
  shape = 'sphere',
  baseScale = 0.01,
  lift = 0.004,
  pulse = false,
  intensity = 1,
  opacity = 1,
  onSelect,
  onHover,
  renderOrder = 3,
  selectedId = null,
  hoveredId = null,
}: InstancedMarkersProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const hoveredRef = useRef<string | null>(null);
  const [hoveredLocal, setHoveredLocal] = useState<string | null>(null);

  const count = points.length;

  const geometry = useMemo(() => {
    if (shape === 'halo') return new THREE.PlaneGeometry(1, 1);
    if (shape === 'plane') return new THREE.PlaneGeometry(1, 1);
    // Low-poly sphere: 8x6 is indistinguishable at marker scale.
    return new THREE.SphereGeometry(0.5, 8, 6);
  }, [shape]);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  const uniforms = useMemo(
    () => ({
      uOpacity: { value: opacity },
      uIntensity: { value: intensity },
      uHighlightBoost: { value: 1 },
      uThickness: { value: 0.16 },
    }),
    [intensity, opacity],
  );

  const activeId = hoveredId ?? hoveredLocal;

  /* Instance buffers — rebuilt on data/highlight change, never per frame. */
  const buffers = useMemo(() => {
    const capacity = Math.max(count, 1);
    const matrices = new Float32Array(capacity * 16);
    const colors = new Float32Array(capacity * 3);
    const scales = new Float32Array(capacity);

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const white = new THREE.Color('#ffffff');
    const identityQuaternion = new THREE.Quaternion();

    points.forEach((point, index) => {
      const radius = 1 + (point.lift ?? lift);
      const isHighlighted = point.id === selectedId || point.id === activeId;
      const scale = point.scale * (isHighlighted ? 1.9 : 1);
      const size = baseScale * scale;

      if (shape === 'plane') {
        orientedMatrix(matrix, point.lat, point.lon, point.heading ?? 0, radius, size);
      } else {
        const position = latLngToVector3(point.lat, point.lon, radius);
        const quaternion =
          shape === 'halo'
            ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize())
            : identityQuaternion;
        matrix.compose(position, quaternion, new THREE.Vector3(size, size, size));
      }

      matrix.toArray(matrices, index * 16);

      color.set(point.color);
      if (isHighlighted) color.lerp(white, 0.4);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;

      scales[index] = scale;
    });

    return { matrices, colors, scales };
  }, [activeId, baseScale, count, lift, points, selectedId, shape]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || count === 0) return;

    mesh.count = count;
    mesh.instanceMatrix.array.set(buffers.matrices);
    mesh.instanceMatrix.needsUpdate = true;

    // Replacing the attributes (rather than mutating) is what keeps the GPU
    // upload proportional to the data change instead of the buffer size.
    mesh.geometry.setAttribute('instanceColor', new THREE.InstancedBufferAttribute(buffers.colors, 3));
    mesh.geometry.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(buffers.scales, 1));
    mesh.geometry.computeBoundingSphere();
  }, [buffers, count]);

  /* The only animated value: a shared breathing opacity. */
  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uHighlightBoost.value = activeId || selectedId ? 1.35 : 1;
    material.uniforms.uOpacity.value = pulse
      ? opacity * (0.8 + 0.2 * Math.sin(clock.elapsedTime * 1.6))
      : opacity;
  });

  const handlePointerOver = (event: { instanceId?: number; stopPropagation: () => void }) => {
    event.stopPropagation();
    if (event.instanceId === undefined) return;
    const point = points[event.instanceId];
    if (!point) return;
    hoveredRef.current = point.id;
    setHoveredLocal(point.id);
    if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
    onHover?.(point.id);
  };

  const handlePointerOut = () => {
    hoveredRef.current = null;
    setHoveredLocal(null);
    if (typeof document !== 'undefined') document.body.style.cursor = '';
    onHover?.(null);
  };

  const handleClick = (event: { instanceId?: number; stopPropagation: () => void }) => {
    event.stopPropagation();
    if (event.instanceId === undefined) return;
    const point = points[event.instanceId];
    if (point) onSelect?.(point.id);
  };

  // Never render an empty instanced mesh: `count = 0` still submits a draw call.
  if (count === 0) return null;

  const isAdditive = shape === 'halo' || shape === 'plane';

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      frustumCulled={false}
      renderOrder={renderOrder}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={shape === 'halo' ? HALO_VERTEX : shape === 'plane' ? PLANE_VERTEX : DOT_VERTEX}
        fragmentShader={shape === 'halo' ? HALO_FRAGMENT : shape === 'plane' ? PLANE_FRAGMENT : DOT_FRAGMENT}
        transparent
        depthWrite={false}
        depthTest={shape !== 'halo'}
        blending={isAdditive ? THREE.AdditiveBlending : THREE.NormalBlending}
        side={shape === 'plane' ? THREE.DoubleSide : THREE.FrontSide}
      />
    </instancedMesh>
  );
}

/**
 * A polyline for a multi-point event track (hurricanes, long-lived wildfires).
 * Kept separate from the marker field so it can carry its own depth behaviour.
 */
export function TrackLine({
  points,
  color,
  lift = 0.004,
  opacity = 0.5,
}: {
  points: Array<{ lat: number; lon: number }>;
  color: string;
  lift?: number;
  opacity?: number;
}) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(points.length * 3);
    points.forEach((point, index) => {
      const vector = latLngToVector3(point.lat, point.lon, 1 + lift);
      positions[index * 3] = vector.x;
      positions[index * 3 + 1] = vector.y;
      positions[index * 3 + 2] = vector.z;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.computeBoundingSphere();
    return geo;
  }, [lift, points]);

  /**
   * Built as a real `THREE.Line` object and mounted with `<primitive>`.
   * Writing `<line>` in JSX would resolve to the SVG element rather than the
   * three.js line, because React's intrinsic element names win over the R3F
   * catalogue for names that exist in both.
   */
  const object = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity,
      depthWrite: false,
    });
    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;
    line.renderOrder = 2;
    return line;
  }, [color, geometry, opacity]);

  useLayoutEffect(
    () => () => {
      (object.material as THREE.Material).dispose();
    },
    [object],
  );

  if (points.length < 2) return null;

  return <primitive object={object} />;
}
