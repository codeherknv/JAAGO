import { connectToDatabase } from './mongodb';
import { Ward } from '@/models/Ward';
import { Complaint } from '@/models/Complaint';

export interface WardLeaderboardStats {
  wardId: string;
  name: string;
  code: string;
  corporation: string;
  totalComplaints: number;
  closedCount: number; // Sample size of closed complaints used as denominator
  citizenVerifiedCount: number;
  autoClosedCount: number;
  reopenedCount: number;
  citizenVerifiedRate: number | null; // 0 to 1, or null if < 10
  participationRate: number | null; // 0 to 100 %, or null if < 10
  autoClosedRate: number | null; // 0 to 1, or null if < 10
  reopenRate: number | null; // 0 to 1, or null if < 10
  slaComplianceRate: number | null; // 0 to 1, or null if < 10
  mttrHours: number | null;
  ctiScore: number | null; // 0 to 100 scale, or null if < 10
  hasEnoughData: boolean; // true if closedCount >= 10
  rank: number | null; // 1, 2, 3... or null if unranked
}

/**
 * Calculates raw statistics for a single ward given its complaints.
 * Closed complaints ('Resolved - Citizen Verified', 'Resolved - Auto Closed') form the denominator.
 * If closedCount < 10, the ward is marked hasEnoughData: false and ctiScore is null.
 */
export function calculateSingleWardStats(ward: any, wardComplaints: any[]): WardLeaderboardStats {
  const totalComplaints = wardComplaints.length;

  // Closed complaints denominator: tickets resolved and closed through citizen verification or auto-close
  const closedComplaints = wardComplaints.filter((c) =>
    ['Resolved - Citizen Verified', 'Resolved - Auto Closed'].includes(c.status)
  );
  const closedCount = closedComplaints.length;

  const citizenVerifiedCount = closedComplaints.filter(
    (c) => c.status === 'Resolved - Citizen Verified'
  ).length;

  const autoClosedCount = closedComplaints.filter(
    (c) => c.status === 'Resolved - Auto Closed'
  ).length;

  const reopenedCount = closedComplaints.filter((c) => (c.reopenCount || 0) > 0).length;

  // Minimum sample size threshold: at least 10 closed complaints required for statistical significance
  const hasEnoughData = closedCount >= 10;

  if (!hasEnoughData) {
    return {
      wardId: ward._id ? ward._id.toString() : ward.wardId || 'unknown',
      name: ward.name || 'Unknown Ward',
      code: ward.code || 'N/A',
      corporation: ward.corporation || 'Greater Bengaluru Authority',
      totalComplaints,
      closedCount,
      citizenVerifiedCount,
      autoClosedCount,
      reopenedCount,
      citizenVerifiedRate: null,
      participationRate: closedCount > 0 ? Math.round((citizenVerifiedCount / closedCount) * 100) : null,
      autoClosedRate: null,
      reopenRate: null,
      slaComplianceRate: null,
      mttrHours: null,
      ctiScore: null,
      hasEnoughData: false,
      rank: null,
    };
  }

  // Denominator is strictly closedCount (>= 10)
  const citizenVerifiedRate = citizenVerifiedCount / closedCount;
  const autoClosedRate = autoClosedCount / closedCount;
  const participationRate = Math.round(citizenVerifiedRate * 100);
  const reopenRate = reopenedCount / closedCount;

  // SLA Compliance: resolved within 72h benchmark
  let slaCompliantCount = 0;
  let totalResolutionTimeHours = 0;

  closedComplaints.forEach((c) => {
    const filedTime = new Date(c.createdAt).getTime();
    const lastEvent = c.statusHistory?.[c.statusHistory.length - 1];
    const resolveTime = lastEvent ? new Date(lastEvent.timestamp).getTime() : Date.now();
    const durationHours = Math.max(1, (resolveTime - filedTime) / (1000 * 60 * 60));

    totalResolutionTimeHours += durationHours;
    if (durationHours <= 72) {
      slaCompliantCount++;
    }
  });

  const slaComplianceRate = slaCompliantCount / closedCount;
  const mttrHours = Math.round(totalResolutionTimeHours / closedCount);

  // Invariant 6: Public Leaderboard Civic Trust Index (CTI)
  // CTI = (0.4 * CitizenVerifiedRate) + (0.4 * (1 - ReopenRate)) + (0.2 * SLAComplianceRate)
  const cti =
    0.4 * citizenVerifiedRate +
    0.4 * Math.max(0, 1 - reopenRate) +
    0.2 * slaComplianceRate;

  const ctiScore = Math.round(cti * 100);

  return {
    wardId: ward._id ? ward._id.toString() : ward.wardId || 'unknown',
    name: ward.name || 'Unknown Ward',
    code: ward.code || 'N/A',
    corporation: ward.corporation || 'Greater Bengaluru Authority',
    totalComplaints,
    closedCount,
    citizenVerifiedCount,
    autoClosedCount,
    reopenedCount,
    citizenVerifiedRate,
    participationRate,
    autoClosedRate,
    reopenRate,
    slaComplianceRate,
    mttrHours,
    ctiScore,
    hasEnoughData: true,
    rank: null, // assigned in rankWardStats
  };
}

/**
 * Ranks wards descending by CTI score.
 * Only wards with >= 10 closed complaints are ranked numerically (1, 2, ...).
 * Wards below the threshold are marked unranked (rank: null) and appended.
 */
export function rankWardStats(stats: WardLeaderboardStats[]): WardLeaderboardStats[] {
  const ranked = stats
    .filter((s) => s.hasEnoughData && s.ctiScore !== null)
    .sort((a, b) => (b.ctiScore ?? 0) - (a.ctiScore ?? 0))
    .map((s, idx) => ({ ...s, rank: idx + 1 }));

  const unranked = stats
    .filter((s) => !s.hasEnoughData)
    .sort((a, b) => b.closedCount - a.closedCount)
    .map((s) => ({ ...s, rank: null }));

  return [...ranked, ...unranked];
}

/**
 * Fetches wards and valid complaints from database and computes ranked leaderboard stats.
 * Complaints without a wardId are ignored.
 */
export async function getLeaderboardData(): Promise<WardLeaderboardStats[]> {
  try {
    await connectToDatabase();
    const wards = await Ward.find().lean();
    // Exclude unassigned/unrouted complaints from leaderboard
    const complaints = await Complaint.find({ wardId: { $ne: null, $exists: true } }).lean();

    const statsList: WardLeaderboardStats[] = wards.map((ward) => {
      const wardComplaints = complaints.filter(
        (c) => c.wardId && c.wardId.toString() === ward._id.toString()
      );
      return calculateSingleWardStats(ward, wardComplaints);
    });

    return rankWardStats(statsList);
  } catch (err) {
    console.error('Failed to compute leaderboard data:', err);
    return [];
  }
}
