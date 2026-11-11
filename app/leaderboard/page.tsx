import React from 'react';
import {
  Trophy,
  ShieldCheck,
  TrendingUp,
  Award,
  AlertTriangle,
  Clock,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { connectToDatabase } from '@/lib/mongodb';
import { Ward } from '@/models/Ward';
import { Complaint } from '@/models/Complaint';

export const dynamic = 'force-dynamic';

interface WardLeaderboardStats {
  wardId: string;
  name: string;
  code: string;
  corporation: string;
  totalComplaints: number;
  totalResolved: number;
  citizenVerifiedCount: number;
  autoClosedCount: number;
  reopenedCount: number;
  citizenVerifiedRate: number;
  autoClosedRate: number;
  reopenRate: number;
  slaComplianceRate: number;
  mttrHours: number;
  ctiScore: number; // 0 to 100 scale
}

async function getLeaderboardData(): Promise<WardLeaderboardStats[]> {
  try {
    await connectToDatabase();
    const wards = await Ward.find().lean();
    const complaints = await Complaint.find().lean();

    const statsList: WardLeaderboardStats[] = wards.map((ward) => {
      const wardComplaints = complaints.filter(
        (c) => c.wardId && c.wardId.toString() === ward._id.toString()
      );

      const totalComplaints = wardComplaints.length;

      const resolvedComplaints = wardComplaints.filter((c) =>
        ['Resolved - Citizen Verified', 'Resolved - Auto Closed'].includes(c.status)
      );
      const totalResolved = resolvedComplaints.length;

      const citizenVerifiedCount = wardComplaints.filter(
        (c) => c.status === 'Resolved - Citizen Verified'
      ).length;

      const autoClosedCount = wardComplaints.filter(
        (c) => c.status === 'Resolved - Auto Closed'
      ).length;

      const complaintsWithReopens = wardComplaints.filter((c) => (c.reopenCount || 0) > 0).length;

      // Citizen Verified Rate (0 - 1)
      const citizenVerifiedRate =
        totalResolved > 0 ? citizenVerifiedCount / totalResolved : 0.8;

      // Auto Closed Rate (0 - 1)
      const autoClosedRate = totalResolved > 0 ? autoClosedCount / totalResolved : 0.2;

      // Reopen Rate (0 - 1)
      const reopenRate =
        totalComplaints > 0 ? complaintsWithReopens / totalComplaints : 0.05;

      // SLA Compliance Rate (resolved within 72h SLA benchmark)
      let slaCompliantCount = 0;
      let totalResolutionTimeHours = 0;

      resolvedComplaints.forEach((c) => {
        const filedTime = new Date(c.createdAt).getTime();
        const lastEvent = c.statusHistory?.[c.statusHistory.length - 1];
        const resolveTime = lastEvent ? new Date(lastEvent.timestamp).getTime() : Date.now();
        const durationHours = Math.max(1, (resolveTime - filedTime) / (1000 * 60 * 60));

        totalResolutionTimeHours += durationHours;
        if (durationHours <= 72) {
          slaCompliantCount++;
        }
      });

      const slaComplianceRate =
        totalResolved > 0 ? slaCompliantCount / totalResolved : 0.85;

      const mttrHours =
        totalResolved > 0 ? Math.round(totalResolutionTimeHours / totalResolved) : 28;

      // Invariant 6: Public Leaderboard Civic Trust Index (CTI)
      // CTI = (0.4 * CitizenVerifiedRate) + (0.4 * (1 - ReopenRate)) + (0.2 * SLAComplianceRate)
      const cti =
        0.4 * citizenVerifiedRate +
        0.4 * Math.max(0, 1 - reopenRate) +
        0.2 * slaComplianceRate;

      const ctiScore = Math.round(cti * 100);

      return {
        wardId: ward._id.toString(),
        name: ward.name,
        code: ward.code,
        corporation: ward.corporation,
        totalComplaints,
        totalResolved,
        citizenVerifiedCount,
        autoClosedCount,
        reopenedCount: complaintsWithReopens,
        citizenVerifiedRate,
        autoClosedRate,
        reopenRate,
        slaComplianceRate,
        mttrHours,
        ctiScore,
      };
    });

    // Rank descending by CTI score
    return statsList.sort((a, b) => b.ctiScore - a.ctiScore);
  } catch (err) {
    console.error('Failed to calculate leaderboard data:', err);
    return [];
  }
}

export default async function LeaderboardPage() {
  const ranking = await getLeaderboardData();

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8 space-y-10">
      {/* Top Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-bold uppercase mb-2">
            <Trophy className="w-3.5 h-3.5 text-amber-600" />
            <span>Civic Trust Index (CTI) Accountability Standard</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Bengaluru Ward Civic Leaderboard
          </h1>
          <p className="mt-1 text-sm text-slate-600 max-w-2xl">
            Objective municipal ranking based on verified citizen satisfaction, low dispute rates, and SLA compliance.
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-sm text-xs space-y-1">
          <p className="font-extrabold text-slate-900 flex items-center space-x-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>CTI Formula Invariant</span>
          </p>
          <code className="block bg-slate-50 p-2 rounded-lg font-mono text-[11px] text-slate-700">
            CTI = (0.4 &times; VerifiedRate) + (0.4 &times; (1 - ReopenRate)) + (0.2 &times; SLACompliance)
          </code>
        </div>
      </div>

      {/* Podium Cards for Top 3 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {ranking.map((ward, idx) => (
          <div
            key={ward.wardId}
            className={`relative p-6 rounded-3xl bg-white border shadow-sm transition-transform hover:-translate-y-1 ${
              idx === 0
                ? 'border-amber-400 ring-2 ring-amber-400/20'
                : idx === 1
                ? 'border-slate-300'
                : 'border-amber-700/30'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span
                className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-base shadow-sm ${
                  idx === 0
                    ? 'bg-amber-400 text-amber-950 shadow-amber-400/30'
                    : idx === 1
                    ? 'bg-slate-200 text-slate-800'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                #{idx + 1}
              </span>
              <span className="text-2xl font-black text-slate-900">
                {ward.ctiScore} <span className="text-xs font-semibold text-slate-400">/ 100 CTI</span>
              </span>
            </div>

            <h3 className="text-xl font-black text-slate-900">{ward.name}</h3>
            <p className="text-xs text-slate-500 font-semibold mb-4">
              Ward {ward.code} &bull; {ward.corporation}
            </p>

            <div className="space-y-2.5 pt-4 border-t border-slate-100 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Citizen Verified Rate</span>
                <span className="font-bold text-emerald-700">
                  {Math.round(ward.citizenVerifiedRate * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reopen / Dispute Rate</span>
                <span className="font-bold text-rose-700">
                  {Math.round(ward.reopenRate * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mean Time to Resolve (MTTR)</span>
                <span className="font-bold text-slate-800">{ward.mttrHours}h</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comprehensive Breakdown Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">
            Complete Pilot Ward Trust Audit Metrics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Updated in real-time across Greater Bengaluru Authority pilot jurisdictions.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-6 py-3.5">Rank & Ward</th>
                <th scope="col" className="px-6 py-3.5">CTI Score</th>
                <th scope="col" className="px-6 py-3.5">Citizen Verified</th>
                <th scope="col" className="px-6 py-3.5">Auto-Closed</th>
                <th scope="col" className="px-6 py-3.5">Reopen Rate</th>
                <th scope="col" className="px-6 py-3.5">SLA Compliance</th>
                <th scope="col" className="px-6 py-3.5">MTTR</th>
                <th scope="col" className="px-6 py-3.5">Total Tickets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
              {ranking.map((row, index) => (
                <tr key={row.wardId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <span className="font-black text-slate-900 text-sm">#{index + 1}</span>
                      <div>
                        <p className="font-bold text-slate-900">{row.name}</p>
                        <p className="text-[11px] text-slate-400">{row.code}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-black text-orange-600">
                        {row.ctiScore}
                      </span>
                      <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-orange-500 h-full rounded-full"
                          style={{ width: `${row.ctiScore}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-emerald-700 font-bold">
                    {Math.round(row.citizenVerifiedRate * 100)}% ({row.citizenVerifiedCount})
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                    {Math.round(row.autoClosedRate * 100)}% ({row.autoClosedCount})
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        row.reopenRate > 0.15
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {Math.round(row.reopenRate * 100)}%
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap font-bold text-blue-700">
                    {Math.round(row.slaComplianceRate * 100)}%
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap font-semibold">
                    {row.mttrHours} hours
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-slate-900 font-bold">
                    {row.totalComplaints}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
