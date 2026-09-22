import * as THREE from 'three';

/**
 * Geographic <-> three.js conversions.
 *
 * The mapping below matches `THREE.SphereGeometry`'s equirectangular UV layout
 * exactly, which is what lets a plain lat/lon pair line up with the blue-marble
 * texture and with the Natural Earth border polylines.
 *
 *   uv.x = (lon + 180) / 360      phi   = (lon + 180) degrees
 *   uv.y = (lat + 90) / 180       theta = (90 - lat)  degrees
 *   x = -r * cos(phi) * sin(theta)
 *   y =  r * cos(theta)
 *   z =  r * sin(phi) * sin(theta)
 */

export const GLOBE_RADIUS = 1;

const DEG = Math.PI / 180;

export interface LatLng {
  lat: number;
  lon: number;
}

/** Projects a coordinate onto a sphere of `radius`, optionally lifted by `altitude`. */
export function latLngToVector3(lat: number, lon: number, radius: number = GLOBE_RADIUS): THREE.Vector3 {
  const phi = (lon + 180) * DEG;
  const theta = (90 - lat) * DEG;
  const sinTheta = Math.sin(theta);
  return new THREE.Vector3(
    -radius * Math.cos(phi) * sinTheta,
    radius * Math.cos(theta),
    radius * Math.sin(phi) * sinTheta,
  );
}

/** Inverse of {@link latLngToVector3}. */
export function vector3ToLatLng(point: THREE.Vector3): LatLng {
  const radius = point.length() || 1;
  const lat = 90 - Math.acos(THREE.MathUtils.clamp(point.y / radius, -1, 1)) / DEG;
  const phi = Math.atan2(point.z, -point.x);
  let lon = phi / DEG - 180;
  while (lon < -180) lon += 360;
  while (lon > 180) lon -= 360;
  return { lat, lon };
}

/**
 * The subsolar point for a given instant.
 *
 * Used to drive the day/night terminator. The Earth mesh itself never rotates
 * (the camera orbits instead), so the terminator stays geographically truthful
 * for the current time without animating 1440 frames a day.
 */
export function subsolarPoint(date: Date): LatLng {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = (date.getTime() - startOfYear) / 86_400_000;
  const declination = -23.44 * Math.cos(((2 * Math.PI) / 365.24) * (dayOfYear + 10.5));
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  let lon = -15 * (utcHours - 12);
  while (lon < -180) lon += 360;
  while (lon > 180) lon -= 360;
  return { lat: declination, lon };
}

/** Unit vector pointing from the Earth's centre toward the Sun. */
export function sunDirection(date: Date = new Date()): THREE.Vector3 {
  const { lat, lon } = subsolarPoint(date);
  return latLngToVector3(lat, lon, 1).normalize();
}

/** Tight bounding box (radians) around a coordinate, for API area queries. */
export function boundingBox(lat: number, lon: number, radiusKm: number) {
  const latDelta = (radiusKm / 111.32) * DEG;
  const lonDelta = (radiusKm / (111.32 * Math.max(0.15, Math.cos(lat * DEG)))) * DEG;
  return {
    lamin: THREE.MathUtils.clamp(lat - latDelta / DEG, -90, 90),
    lamax: THREE.MathUtils.clamp(lat + latDelta / DEG, -90, 90),
    lomin: THREE.MathUtils.clamp(lon - lonDelta / DEG, -180, 180),
    lomax: THREE.MathUtils.clamp(lon + lonDelta / DEG, -180, 180),
  };
}

/**
 * Basis aligned to the local tangent plane at a coordinate.
 *
 * `north`/`east` are true local tangent directions, which is what lets an
 * aircraft marker point along its real heading rather than a fixed axis.
 */
export function localFrame(lat: number, lon: number) {
  const up = latLngToVector3(lat, lon, 1).normalize();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const north = worldUp.clone().addScaledVector(up, -worldUp.dot(up));
  if (north.lengthSq() < 1e-8) {
    // Degenerate at the poles: fall back to any perpendicular direction.
    north.set(0, 0, 1).addScaledVector(up, -up.z);
  }
  north.normalize();
  const east = new THREE.Vector3().crossVectors(up, north).normalize();
  return { up, north, east };
}

/** Matrix placing a `+Z`-forward model at a coordinate, yawed to `headingDeg`. */
export function orientedMatrix(
  target: THREE.Matrix4,
  lat: number,
  lon: number,
  headingDeg: number,
  radius: number,
  scale: number,
): THREE.Matrix4 {
  const { up, north, east } = localFrame(lat, lon);
  const heading = headingDeg * DEG;
  const forward = north
    .clone()
    .multiplyScalar(Math.cos(heading))
    .addScaledVector(east, Math.sin(heading))
    .normalize();
  const xAxis = new THREE.Vector3().crossVectors(up, forward).normalize();
  const rotation = new THREE.Matrix4().makeBasis(xAxis, up, forward);
  const position = up.clone().multiplyScalar(radius);
  return target.compose(position, new THREE.Quaternion().setFromRotationMatrix(rotation), new THREE.Vector3(scale, scale, scale));
}
