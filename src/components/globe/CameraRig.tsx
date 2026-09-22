'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useTerraScope } from '@/lib/store/useTerraScope';
import { latLngToVector3 } from '@/lib/utils/geo';

/**
 * Camera director.
 *
 * OrbitControls owns the camera in steady state; this rig takes over only while
 * a scripted move is running and hands control straight back when it finishes.
 * That split matters: fighting OrbitControls' damping produces the jitter you
 * see in most "fly to" implementations.
 *
 * Motion is a slerp of the view *direction* plus a lerp of the radius, eased
 * with a cubic-out curve. Rotating the direction (rather than lerping the
 * position through space) is what makes the camera arc around the planet
 * instead of cutting through it.
 */

const FLY_DURATION = 1250;
const ZOOM_DURATION = 420;
const MIN_RADIUS = 1.18;
const MAX_RADIUS = 6.2;

type ControlsLike = {
  enabled: boolean;
  autoRotate: boolean;
  autoRotateSpeed: number;
  update: () => void;
} | null;

export function CameraRig() {
  const controls = useThree((state) => state.controls) as unknown as ControlsLike;
  const camera = useThree((state) => state.camera);

  const flyTo = useTerraScope((s) => s.flyTo);
  const zoom = useTerraScope((s) => s.zoom);
  const autoRotate = useTerraScope((s) => s.autoRotate);
  const setAutoRotate = useTerraScope((s) => s.setAutoRotate);

  const animationRef = useRef<{
    startedAt: number;
    duration: number;
    fromDirection: THREE.Vector3;
    toDirection: THREE.Vector3;
    fromRadius: number;
    toRadius: number;
  } | null>(null);

  /* Idle auto-rotation, suspended while the user drags. */
  useEffect(() => {
    if (!controls) return;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.16;
  }, [autoRotate, controls]);

  /* Scripted fly-to */
  useEffect(() => {
    if (!flyTo) return;
    const targetRadius = THREE.MathUtils.clamp(flyTo.distance ?? 2.6, MIN_RADIUS, MAX_RADIUS);
    const toDirection = latLngToVector3(flyTo.lat, flyTo.lon, 1).normalize();

    animationRef.current = {
      startedAt: performance.now(),
      duration: FLY_DURATION,
      fromDirection: camera.position.clone().normalize(),
      toDirection,
      fromRadius: camera.position.length(),
      toRadius: targetRadius,
    };
    setAutoRotate(false);
  }, [camera, flyTo, setAutoRotate]);

  /* Scripted zoom */
  useEffect(() => {
    if (!zoom) return;
    const current = animationRef.current;
    const fromRadius = current
      ? THREE.MathUtils.lerp(current.fromRadius, current.toRadius, easeCubicOut(progress(current)))
      : camera.position.length();

    const factor = zoom.direction === 'in' ? 0.78 : 1.28;
    animationRef.current = {
      startedAt: performance.now(),
      duration: ZOOM_DURATION,
      fromDirection: camera.position.clone().normalize(),
      toDirection: camera.position.clone().normalize(),
      fromRadius,
      toRadius: THREE.MathUtils.clamp(fromRadius * factor, MIN_RADIUS, MAX_RADIUS),
    };
  }, [camera, zoom]);

  useFrame(() => {
    const animation = animationRef.current;
    if (!animation) return;

    const t = progress(animation);
    const eased = easeCubicOut(t);

    // Slerp the two unit directions through quaternions: stable and shortest-arc.
    const qFrom = new THREE.Quaternion().setFromUnitVectors(FORWARD, animation.fromDirection);
    const qTo = new THREE.Quaternion().setFromUnitVectors(FORWARD, animation.toDirection);
    const blended = qFrom.clone().slerp(qTo, eased);
    const direction = FORWARD.clone().applyQuaternion(blended).normalize();

    const radius = THREE.MathUtils.lerp(animation.fromRadius, animation.toRadius, eased);
    camera.position.copy(direction.multiplyScalar(radius));
    camera.lookAt(0, 0, 0);

    if (controls) {
      // Suspend OrbitControls for the duration so damping cannot fight the rig.
      controls.enabled = t < 1;
    }

    if (t >= 1) {
      animationRef.current = null;
      if (controls) {
        controls.enabled = true;
        controls.autoRotate = autoRotate;
        controls.update();
      }
    }
  });

  return null;
}

const FORWARD = new THREE.Vector3(0, 0, 1);

function progress(animation: { startedAt: number; duration: number }): number {
  const elapsed = performance.now() - animation.startedAt;
  return THREE.MathUtils.clamp(elapsed / animation.duration, 0, 1);
}

function easeCubicOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Keeps the selected marker visible by nudging the camera when a selection is
 * made from a list rather than from a click (which already implies focus).
 */
export function useFocusSelection() {
  const selection = useTerraScope((s) => s.selection);
  const flyToRequest = useTerraScope((s) => s.flyTo);

  return useMemo(() => {
    if (!selection) return null;
    return { kind: selection.kind, nonce: flyToRequest?.nonce ?? 0 };
  }, [flyToRequest?.nonce, selection]);
}
