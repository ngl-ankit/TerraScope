'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * Starfield.
 *
 * A single `Points` draw call with additive blending. Stars are distributed on
 * a large shell with uniform-solid-angle sampling (so the poles do not look
 * crowded), and each vertex carries its own brightness and a subtle colour
 * temperature, which is what makes the field read as depth rather than dots.
 *
 * Rotation is extremely slow and stops entirely under reduced-motion.
 */

interface StarfieldProps {
  count: number;
  animate: boolean;
}

export function Starfield({ count, animate }: StarfieldProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const tint = new THREE.Color();

    for (let i = 0; i < count; i += 1) {
      // Uniform on a sphere: cos(theta) uniform in [-1, 1].
      const u = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const radius = 26 + Math.random() * 18;

      positions[i * 3] = Math.cos(theta) * r * radius;
      positions[i * 3 + 1] = u * radius;
      positions[i * 3 + 2] = Math.sin(theta) * r * radius;

      // Mostly white, some blue-white and a few warm ones.
      const roll = Math.random();
      if (roll > 0.93) tint.setHSL(0.08, 0.55, 0.72);
      else if (roll > 0.78) tint.setHSL(0.58, 0.4, 0.82);
      else tint.setHSL(0.6, 0.06, 0.88);

      const brightness = 0.35 + Math.random() * 0.65;
      colors[i * 3] = tint.r * brightness;
      colors[i * 3 + 1] = tint.g * brightness;
      colors[i * 3 + 2] = tint.b * brightness;

      sizes[i] = Math.random() < 0.02 ? 2.4 : 0.7 + Math.random() * 0.9;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.computeBoundingSphere();
    return geo;
  }, [count]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1) },
        uOpacity: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        varying vec3 vColor;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (220.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        uniform float uOpacity;
        void main() {
          // Soft circular falloff instead of a hard square sprite.
          vec2 offset = gl_PointCoord - vec2(0.5);
          float dist = length(offset);
          float strength = smoothstep(0.5, 0.06, dist);
          if (strength <= 0.001) discard;
          gl_FragColor = vec4(vColor, strength * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });
  }, []);

  useLayoutEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((_, delta) => {
    if (!animate || !pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.0035;
    pointsRef.current.rotation.x += delta * 0.0008;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
}
