import { ComplaintCategory } from '@/models/Complaint';

/**
 * Service Level Agreement (SLA) Configuration per Category.
 *
 * SLA CLOCK SPECIFICATION:
 * - The SLA clock starts at complaint creation (`complaint.createdAt`).
 * - The SLA clock stops at the officer's resolution action, when the officer
 *   submits on-site GPS verification and resolution proof, transitioning
 *   the ticket to 'Pending Verification'.
 * - For complaints that remain open and have not yet been resolved by an officer
 *   (e.g., 'Pending', 'In Progress', 'Reopened - Escalated', 'Disputed - Admin Review'),
 *   the clock runs continuously from `createdAt` to the current evaluation time (`Date.now()`).
 * - If an open complaint is currently in 'Pending Verification', the officer has already
 *   acted; the duration is measured from `createdAt` to that officer's resolution timestamp.
 */

export const CATEGORY_SLA_HOURS: Record<ComplaintCategory, number> = {
  Sanitation: 24,
  Streetlights: 48,
  'Water Supply & Drainage': 48,
  Roads: 72,
  Others: 72,
};

export const DEFAULT_SLA_HOURS = 72;

/**
 * Returns the SLA limit in hours for a given complaint category.
 * Defaults to 72 hours if category is missing or not matched.
 */
export function getCategorySlaHours(category?: string | null): number {
  if (!category) return DEFAULT_SLA_HOURS;
  if (category in CATEGORY_SLA_HOURS) {
    return CATEGORY_SLA_HOURS[category as ComplaintCategory];
  }
  // Case-insensitive lookup fallback
  const normalized = Object.keys(CATEGORY_SLA_HOURS).find(
    (k) => k.toLowerCase() === category.trim().toLowerCase()
  );
  if (normalized) {
    return CATEGORY_SLA_HOURS[normalized as ComplaintCategory];
  }
  return DEFAULT_SLA_HOURS;
}

/**
 * Extracts the timestamp (in milliseconds) of the officer's resolve action.
 * Traverses statusHistory in reverse to find the latest resolution submission
 * (transition to 'Pending Verification' or officer resolution event).
 */
export function getOfficerResolveTimestamp(complaint: any): number | null {
  if (Array.isArray(complaint.statusHistory) && complaint.statusHistory.length > 0) {
    const resolveEvent = [...complaint.statusHistory].reverse().find(
      (e: any) =>
        e.status === 'Pending Verification' ||
        (e.role === 'officer' && String(e.status).startsWith('Resolved'))
    );
    if (resolveEvent && resolveEvent.timestamp) {
      return new Date(resolveEvent.timestamp).getTime();
    }
    // Fallback: If no explicit Pending Verification event is found (e.g. test fixture),
    // use the latest statusHistory event before or at resolution
    const lastEvent = complaint.statusHistory[complaint.statusHistory.length - 1];
    if (lastEvent && lastEvent.timestamp) {
      return new Date(lastEvent.timestamp).getTime();
    }
  }
  return null;
}

/**
 * Evaluates whether a complaint is past its category SLA.
 * - For closed complaints or complaints currently in 'Pending Verification',
 *   the clock stopped at the officer's resolution action.
 * - For complaints still awaiting officer action, the clock runs to `now`.
 */
export function isComplaintOverdue(complaint: any, now: number = Date.now()): boolean {
  const filedTime = new Date(complaint.createdAt).getTime();
  const slaLimitHours = getCategorySlaHours(complaint.category);
  const slaLimitMs = slaLimitHours * 60 * 60 * 1000;

  // If the complaint is in Pending Verification or a closed resolved state,
  // evaluate against the officer's resolution timestamp.
  const isResolvedOrVerifying =
    complaint.status === 'Pending Verification' ||
    String(complaint.status).startsWith('Resolved');

  let resolveTime: number | null = null;
  if (isResolvedOrVerifying) {
    resolveTime = getOfficerResolveTimestamp(complaint);
  }

  const effectiveEndTime = resolveTime !== null ? resolveTime : now;
  const elapsedMs = Math.max(0, effectiveEndTime - filedTime);
  return elapsedMs > slaLimitMs;
}
