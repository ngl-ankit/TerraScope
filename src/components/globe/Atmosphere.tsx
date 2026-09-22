'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { sunDirection } from '@/lib/utils/geo';

/**
 * Atmospheric shells.
 *
 * Two additive back-face spheres rather than a post-process bloom pass: bloom
 * costs a full-screen blur every frame, while this is two cheap draws and it
 * degrades gracefully on mobile GPUs (where the second shell is skipped).
 *
 * The shader is a squared-exponent Fresnel term, skewed toward the sunlit limb
 * so the glow reads as scattered sunlight rather than a uniform halo.
 */

const ATMOSPHERE_VERTEX = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const ATMOSPHERE_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uSunDirection;
  uniform float uIntensity;
  uniform float uPower;
  uniform float uBias;

  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float rim = 1.0 - abs(dot(normalize(vNormal), viewDirection));
    rim = pow(clamp(rim, 0.0, 1.0), uPower);

    float sunFacing = dot(normalize(vNormal), normalize(uSunDirection));
    // Scattering is strongest where the shell faces the sun and the viewer sees
    // it edge-on.
    float scatter = uBias + (1.0 - uBias) * smoothstep(-0.6, 0.9, sunFacing);

    float alpha = rim * uIntensity * scatter;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

interface AtmosphereProps {
  /** Outer shell is skipped on the lowest tier. */
  enableOuterShell: boolean;
  animateSun: boolean;
}

export function Atmosphere({ enableOuterShell, animateSun }: AtmosphereProps) {
  const sunRef = useRef(new THREE.Vector3(...sunDirection(new Date()).toArray()));

  const innerUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#4aa8ff') },
      uSunDirection: { value: sunRef.current },
      uIntensity: { value: 0.85 },
      uPower: { value: 3.1 },
      uBias: { value: 0.22 },
    }),
    [],
  );

  const outerUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color('#2f6fd0') },
      uSunDirection: { value: sunRef.current },
      uIntensity: { value: 0.42 },
      uPower: { value: 4.4 },
      uBias: { value: 0.15 },
    }),
    [],
  );

  useFrame((_, delta) => {
    if (!animateSun) return;
    // Continuous drift keeps the terminator honest without a per-minute jump.
    const target = sunDirection(new Date());
    sunRef.current.lerp(target, Math.min(1, delta * 0.35));
  });

  return (
    <group>
      <mesh scale={1.022} frustumCulled={false}>
        <sphereGeometry args={[1, 64, 32]} />
        <shaderMaterial
          uniforms={innerUniforms}
          vertexShader={ATMOSPHERE_VERTEX}
          fragmentShader={ATMOSPHERE_FRAGMENT}
          transparent
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {enableOuterShell && (
        <mesh scale={1.075} frustumCulled={false}>
          <sphereGeometry args={[1, 48, 24]} />
          <shaderMaterial
            uniforms={outerUniforms}
            vertexShader={ATMOSPHERE_VERTEX}
            fragmentShader={ATMOSPHERE_FRAGMENT}
            transparent
            blending={THREE.AdditiveBlending}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
