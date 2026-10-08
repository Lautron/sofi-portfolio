/**
 * Returns the landmark closest to `z` along the route, or undefined when none
 * lies within `radius`. Ties keep the earlier landmark.
 */
export function findNearbyLandmark<T extends { roadPosition: Readonly<{ z: number }> }>(
  landmarks: readonly T[],
  z: number,
  radius: number,
): T | undefined {
  let nearest: T | undefined
  let nearestDistance = radius
  for (const landmark of landmarks) {
    const distance = Math.abs(landmark.roadPosition.z - z)
    if (distance <= nearestDistance && (nearest === undefined || distance < nearestDistance)) {
      nearest = landmark
      nearestDistance = distance
    }
  }
  return nearest
}
