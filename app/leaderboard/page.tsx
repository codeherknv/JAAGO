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
  BarChart3,
  Users,
} from 'lucide-react';
import { getLeaderboardData, WardLeaderboardStats } from '@/lib/leaderboard';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const ranking = await getLeaderboardData();

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8 space-y-10">
      {/* Top Header Section */}
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
            Rankings require a minimum statistical threshold of at least 10 closed complaints.
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-sm text-xs space-y-1">
          <p className="font-extrabold text-slate-900 flex items-center space-x-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>CTI Invariant &amp; Denominator</span>
          </p>
          <code className="block bg-slate-50 p-2 rounded-lg font-mono text-[11px] text-slate-700">
            CTI = (0.4 &times; VerifiedRate) + (0.4 &times; (1 - ReopenRate)) + (0.2 &times; SLACompliance)
          </code>
          <p className="text-[11px] text-slate-500 pt-1">
            Denominator = Closed Tickets (Citizen Verified + Auto Closed). Threshold: &ge; 10.
          </p>
        </div>
      </div>

      {/* Podium Cards for Top Wards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {ranking.slice(0, 3).map((ward, idx) => (
          <div
            key={ward.wardId}
            className={`relative p-6 rounded-3xl bg-white border shadow-sm transition-transform hover:-translate-y-1 ${
              ward.rank === 1
                ? 'border-amber-400 ring-2 ring-amber-400/20'
                : ward.rank === 2
                ? 'border-slate-300'
                : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span
                className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-base shadow-sm ${
                  ward.rank === 1
                    ? 'bg-amber-400 text-amber-950 shadow-amber-400/30'
                    : ward.rank === 2
                    ? 'bg-slate-200 text-slate-800'
                    : ward.rank === 3
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {ward.rank ? `#${ward.rank}` : '-'}
              </span>

              {ward.hasEnoughData && ward.ctiScore !== null ? (
                <span className="text-2xl font-black text-slate-900">
                  {ward.ctiScore} <span className="text-xs font-semibold text-slate-400">/ 100 CTI</span>
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-xs border border-slate-200">
                  Not enough data
                </span>
              )}
            </div>

            <h3 className="text-xl font-black text-slate-900">{ward.name}</h3>
            <p className="text-xs text-slate-500 font-semibold mb-4">
              Ward {ward.code} &bull; {ward.corporation}
            </p>

            <div className="space-y-2.5 pt-4 border-t border-slate-100 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Sample Size (Closed)</span>
                <span className="font-bold text-slate-800">
                  {ward.closedCount} closed tickets {ward.closedCount < 10 ? '(< 10 min)' : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Citizen Participation</span>
                <span className="font-bold text-emerald-700">
                  {ward.participationRate !== null ? `${ward.participationRate}%` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Citizen Verified / Auto Closed</span>
                <span className="font-bold text-slate-700">
                  {ward.citizenVerifiedCount} ver / {ward.autoClosedCount} auto
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reopen / Dispute Rate</span>
                <span className="font-bold text-rose-700">
                  {ward.reopenRate !== null ? `${Math.round(ward.reopenRate * 100)}%` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mean Time to Resolve</span>
                <span className="font-bold text-slate-800">
                  {ward.mttrHours !== null ? `${ward.mttrHours}h` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comprehensive Breakdown Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Complete Pilot Ward Trust Audit Metrics
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Metrics calculated using closed complaints as denominator. Wards with &lt; 10 closed complaints are marked &quot;Not enough data&quot;.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <BarChart3 className="w-4 h-4 text-orange-600" />
            <span>Sample Threshold: 10 closed tickets</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-6 py-3.5">Rank &amp; Ward</th>
                <th scope="col" className="px-6 py-3.5">CTI Score</th>
                <th scope="col" className="px-6 py-3.5">Sample Size (Closed)</th>
                <th scope="col" className="px-6 py-3.5">Citizen Verified</th>
                <th scope="col" className="px-6 py-3.5">Auto-Closed</th>
                <th scope="col" className="px-6 py-3.5">Participation Rate</th>
                <th scope="col" className="px-6 py-3.5">Reopen Rate</th>
                <th scope="col" className="px-6 py-3.5">SLA Compliance</th>
                <th scope="col" className="px-6 py-3.5">MTTR</th>
                <th scope="col" className="px-6 py-3.5">Total Tickets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white font-medium text-slate-700">
              {ranking.map((row) => (
                <tr key={row.wardId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <span className="font-black text-slate-900 text-sm">
                        {row.rank ? `#${row.rank}` : '-'}
                      </span>
                      <div>
                        <p className="font-bold text-slate-900">{row.name}</p>
                        <p className="text-[11px] text-slate-400">{row.code}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {row.hasEnoughData && row.ctiScore !== null ? (
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
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[11px]">
                        Not enough data
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">
                    {row.closedCount} {row.closedCount < 10 ? <span className="text-[10px] text-amber-600 font-normal">(&lt; 10)</span> : ''}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-emerald-700 font-bold">
                    {row.citizenVerifiedCount} {row.citizenVerifiedRate !== null ? `(${Math.round(row.citizenVerifiedRate * 100)}%)` : ''}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                    {row.autoClosedCount} {row.autoClosedRate !== null ? `(${Math.round(row.autoClosedRate * 100)}%)` : ''}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap font-bold text-emerald-700">
                    {row.participationRate !== null ? `${row.participationRate}%` : 'N/A'}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {row.reopenRate !== null ? (
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          row.reopenRate > 0.15
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {Math.round(row.reopenRate * 100)}%
                      </span>
                    ) : (
                      <span className="text-slate-400">N/A</span>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap font-bold text-blue-700">
                    {row.slaComplianceRate !== null ? `${Math.round(row.slaComplianceRate * 100)}%` : 'N/A'}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap font-semibold">
                    {row.mttrHours !== null ? `${row.mttrHours} hours` : 'N/A'}
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
