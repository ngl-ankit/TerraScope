'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useEarthTextures } from '@/lib/hooks/useEarthTextures';
import { useCountryBorders, worldPointToLatLon } from '@/lib/hooks/useCountryBorders';
import { useTerraScope } from '@/lib/store/useTerraScope';
import { GLOBE_RADIUS, sunDirection } from '@/lib/utils/geo';
import type { DeviceProfile } from '@/lib/hooks/useDeviceProfile';

/**
 * The Earth itself.
 *
 * Rendering decisions worth calling out:
 *
 * 1. Day/night is a single custom shader, not two meshes. The terminator comes
 *    from `dot(normal, sunDirection)`, so it is geographically correct for the
 *    current UTC time without animating the sphere (the camera orbits instead).
 * 2. Colour space: textures are uploaded with `NoColorSpace` and sampled raw, so
 *    the blend happens in the source's own gamma space. That keeps the blue
 *    marble's contrast intact and avoids the washed-out look a half-configured
 *    linear pipeline produces.
 * 3. Water gets a real specular highlight via the NASA water mask, which is what
 *    separates "photorealistic Earth" from "textured ball".
 * 4. Country borders are one merged `LineSegments` buffer, so 177 countries cost
 *    a single draw call.
 */

const EARTH_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const EARTH_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uSpecularMap;
  uniform sampler2D uTopologyMap;
  uniform vec3 uSunDirection;
  uniform float uNightIntensity;
  uniform float uSpecularStrength;
  uniform float uReliefStrength;
  uniform float uAtmosphere;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vec3 dayColor = texture2D(uDayMap, vUv).rgb;
    vec3 nightLights = texture2D(uNightMap, vUv).rgb;
    float waterMask = texture2D(uSpecularMap, vUv).r;
    vec3 topology = texture2D(uTopologyMap, vUv).rgb;

    vec3 normal = normalize(vNormal);
    float sunDot = dot(normal, normalize(uSunDirection));

    // Soft, wide terminator: a hard cut looks cartoonish on a sphere this large.
    float daylight = smoothstep(-0.22, 0.28, sunDot);

    // Lambert shading with a lifted ambient so the dark limb stays readable.
    float lambert = clamp(sunDot, 0.0, 1.0);
    vec3 lit = dayColor * (0.34 + 0.82 * lambert);

    // Mountain relief from the NASA topology map, applied only where sunlit.
    lit += vec3((topology.r - 0.5) * uReliefStrength * lambert);

    // City lights, boosted where the night side is darkest.
    float nightFactor = 1.0 - daylight;
    vec3 night = nightLights * uNightIntensity * nightFactor * (0.75 + 0.5 * nightFactor);

    vec3 color = mix(night, lit, daylight);

    // Specular sheen on open water, so oceans read as reflective.
    vec3 viewDir = normalize(cameraPosition - vPosition);
    vec3 halfVector = normalize(normalize(uSunDirection) + viewDir);
    float specular = pow(max(dot(normal, halfVector), 0.0), 48.0);
    color += vec3(1.0, 0.98, 0.94) * specular * uSpecularStrength * waterMask * daylight;

    // Fresnel rim: the thin blue edge that reads as atmosphere when the globe
    // is silhouetted against space.
    float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 2.4);
    color += vec3(0.24, 0.52, 0.92) * fresnel * uAtmosphere * (0.35 + daylight * 0.65);

    gl_FragColor = vec4(color, 1.0);
  }
`;

const BORDER_VERTEX_SHADER = /* glsl */ `
  varying float vFacing;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vec3 viewDir = normalize(cameraPosition - worldPosition.xyz);
    vec3 normal = normalize(mat3(modelMatrix) * normalize(position));
    // Fade borders toward the limb so they do not clutter the silhouette.
    vFacing = clamp(dot(normal, viewDir), 0.0, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const BORDER_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vFacing;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity * smoothstep(0.05, 0.55, vFacing));
  }
`;

/** Minimal structural type for R3F pointer events (avoids a version-bound import). */
export interface ThreeEvent {
  point?: THREE.Vector3;
  stopPropagation: () => void;
  instanceId?: number;
}

interface EarthMeshProps {
  profile: DeviceProfile;
  onSurfaceClick: (lat: number, lon: number) => void;
}

export function EarthMesh({ profile, onSurfaceClick }: EarthMeshProps) {
  const setBootStep = useTerraScope((s) => s.setBootStep);
  const setAutoRotate = useTerraScope((s) => s.setAutoRotate);

  const textures = useEarthTextures(profile.textureSize);
  const borders = useCountryBorders(true);

  /* Report texture + border progress to the boot screen. */
  useEffect(() => {
    setBootStep('textures', textures.ready ? 'done' : 'active', textures.progress);
  }, [setBootStep, textures.progress, textures.ready]);

  useEffect(() => {
    if (borders.ready) setBootStep('borders', borders.error ? 'failed' : 'done');
    else setBootStep('borders', 'active');
  }, [borders.error, borders.ready, setBootStep]);

  /* Sun direction, recomputed every minute (the subsolar point drifts 0.25°/min). */
  const sunRef = useRef(sunDirection(new Date()));
  useEffect(() => {
    sunRef.current.copy(sunDirection(new Date()));
    if (!profile.animateTerminator) return;
    const id = setInterval(() => sunRef.current.copy(sunDirection(new Date())), 60_000);
    return () => clearInterval(id);
  }, [profile.animateTerminator]);

  const earthUniforms = useMemo(
    () => ({
      uDayMap: { value: textures.day },
      uNightMap: { value: textures.night },
      uSpecularMap: { value: textures.specular },
      uTopologyMap: { value: textures.topology },
      // Shared by reference with the ref above, so the interval's mutations are
      // picked up without rebuilding the material.
      uSunDirection: { value: sunRef.current },
      uNightIntensity: { value: 1.15 },
      uSpecularStrength: { value: 0.55 },
      uReliefStrength: { value: 0.1 },
      uAtmosphere: { value: 0.45 },
    }),
    // Sampler identities only change when the texture set is swapped.
    [textures.day, textures.night, textures.specular, textures.topology],
  );

  const borderUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#9fd8ff') },
      uOpacity: { value: 0.34 },
    }),
    [],
  );

  const handleClick = (event: ThreeEvent) => {
    event.stopPropagation();
    if (!event.point) return;
    const { lat, lon } = worldPointToLatLon(event.point);
    onSurfaceClick(lat, lon);
  };

  return (
    <group>
      <mesh
        onClick={handleClick}
        onPointerOver={() => setAutoRotate(false)}
        onPointerOut={() => setAutoRotate(true)}
        frustumCulled={false}
      >
        <sphereGeometry args={[GLOBE_RADIUS, profile.globeSegments, profile.globeSegments / 2]} />
        <shaderMaterial
          uniforms={earthUniforms}
          vertexShader={EARTH_VERTEX_SHADER}
          fragmentShader={EARTH_FRAGMENT_SHADER}
        />
      </mesh>

      {/* Country borders — one merged buffer, one draw call */}
      {borders.segmentCount > 0 && (
        <lineSegments frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[borders.positions, 3]}
              count={borders.positions.length / 3}
            />
          </bufferGeometry>
          <shaderMaterial
            uniforms={borderUniforms}
            vertexShader={BORDER_VERTEX_SHADER}
            fragmentShader={BORDER_FRAGMENT_SHADER}
            transparent
            depthWrite={false}
          />
        </lineSegments>
      )}
    </group>
  );
}
