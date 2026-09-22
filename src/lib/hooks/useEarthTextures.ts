'use client';

import { useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

/**
 * Loads the Earth texture set with real progress reporting.
 *
 * `useTexture`/Suspense would be shorter but gives no progress signal, and the
 * loading screen genuinely needs one: the 4K set is ~2 MB. Textures are loaded
 * imperatively here so the boot screen can show "Loading Earth imagery 62%".
 *
 * If a texture fails (offline, CDN hiccup) a flat fallback is substituted so the
 * shader always has a valid sampler — the globe keeps rendering, borders stay
 * visible, and the failure surfaces as a non-blocking notice.
 */

export interface EarthTextures {
  day: THREE.Texture;
  night: THREE.Texture;
  specular: THREE.Texture;
  topology: THREE.Texture;
  ready: boolean;
  /** 0..1 aggregate progress. */
  progress: number;
  /** Names of textures that could not be loaded. */
  failed: string[];
}

type TextureKey = 'day' | 'night' | 'specular' | 'topology';

/** 1x1 stand-in so a failed load never leaves the shader without a sampler. */
function solidTexture(): THREE.Texture {
  const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

export function useEarthTextures(resolution: '2k' | '4k'): EarthTextures {
  const gl = useThree((state) => state.gl);

  const [fallbacks] = useState<Record<TextureKey, THREE.Texture>>(() => ({
    day: solidTexture(),
    night: solidTexture(),
    specular: solidTexture(),
    topology: solidTexture(),
  }));

  const [state, setState] = useState<EarthTextures>(() => ({
    ...fallbacks,
    ready: false,
    progress: 0,
    failed: [],
  }));

  useEffect(() => {
    let cancelled = false;
    const manager = new THREE.LoadingManager();
    const loader = new THREE.TextureLoader(manager);
    const suffix = resolution === '2k' ? '-2k' : '';

    const sources: Record<TextureKey, string> = {
      day: `/textures/earth-day${suffix}.jpg`,
      night: `/textures/earth-night${suffix}.jpg`,
      specular: `/textures/earth-specular${suffix}.png`,
      topology: `/textures/earth-topology${suffix}.png`,
    };

    const keys = Object.keys(sources) as TextureKey[];
    const loaded: Partial<Record<TextureKey, THREE.Texture>> = {};
    const failed: string[] = [];
    let completed = 0;

    const anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());

    const settle = () => {
      completed += 1;
      if (cancelled) return;

      if (completed === keys.length) {
        setState({
          day: loaded.day ?? fallbacks.day,
          night: loaded.night ?? fallbacks.night,
          specular: loaded.specular ?? fallbacks.specular,
          topology: loaded.topology ?? fallbacks.topology,
          ready: true,
          progress: 1,
          failed,
        });
      } else {
        setState((prev) => ({ ...prev, progress: completed / keys.length }));
      }
    };

    for (const key of keys) {
      loader.load(
        sources[key],
        (texture) => {
          if (cancelled) {
            texture.dispose();
            return;
          }
          // Raw sampling: the shader blends in the texture's own gamma space,
          // which preserves the blue marble's contrast.
          texture.colorSpace = THREE.NoColorSpace;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.anisotropy = anisotropy;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          loaded[key] = texture;
          settle();
        },
        undefined,
        () => {
          failed.push(key);
          settle();
        },
      );
    }

    return () => {
      cancelled = true;
      for (const texture of Object.values(loaded)) texture?.dispose();
    };
  }, [fallbacks, gl, resolution]);

  // Fallback textures are process-lifetime objects, not per-mount resources.
  useEffect(
    () => () => {
      for (const texture of Object.values(fallbacks)) texture.dispose();
    },
    [fallbacks],
  );

  return state;
}
