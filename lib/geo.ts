/**
 * Geographic calculations and Civic Invariants
 */

// Calculate Haversine distance in meters between two [latitude, longitude] pairs
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Invariant 4: Location-Verified Resolution
 * Allowed Radius = Math.max(50, device_accuracy + 15).
 */
export function calculateAllowedResolutionRadius(accuracyMeters: number): number {
  return Math.max(50, (accuracyMeters || 0) + 15);
}

/**
 * Category Weights for Priority Scoring
 */
export const CATEGORY_WEIGHTS: Record<string, number> = {
  Roads: 4, // Potholes, road hazard
  Sanitation: 3, // Waste, epidemic hazard
  Streetlights: 2, // Dark spots
  'Water Supply & Drainage': 5, // Drain collapse, contaminated water
  Others: 1,
};

/**
 * Invariant 4 / Phase 4: Dynamic Priority Score calculation
 * Priority = (CategoryWeight * 2) + (Upvotes * 1.5) + (HoursOpen / 24) + (ReopenCount * 5).
 */
export function calculatePriorityScore(
  category: string,
  upvotes: number,
  createdAt: Date,
  reopenCount: number
): number {
  const categoryWeight = CATEGORY_WEIGHTS[category] || 1;
  const hoursOpen = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
  const score =
    categoryWeight * 2 +
    (upvotes || 1) * 1.5 +
    hoursOpen / 24 +
    (reopenCount || 0) * 5;

  return Math.round(score * 10) / 10;
}
