import React from 'react';
import Link from 'next/link';
import { ShieldCheck, HelpCircle, ChevronRight, AlertCircle, BarChart3 } from 'lucide-react';
import { getLeaderboardData, WardLeaderboardStats } from '@/lib/leaderboard';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const ranking = await getLeaderboardData();

  return (
    <div className="w-full bg-kerb min-h-[calc(100vh-64px)] pb-20 md:pb-12">
      {/* Top Header Plate */}
      <div className="bg-white border-b border-border py-6 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-plate bg-signboard-blue text-white text-[11px] font-heading font-bold">
              Accountability Index
            </span>
            <span className="text-xs text-asphalt-muted font-sans">
              Greater Bengaluru Municipal Pilot
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-heading font-black text-asphalt tracking-tight">
            Civic Trust Index Leaderboard
          </h1>

          {/* One plain sentence explaining what the index measures */}
          <p className="text-sm font-sans text-asphalt leading-relaxed max-w-3xl">
            The Civic Trust Index measures how reliably and promptly municipal complaints are resolved and verified by citizens.
          </p>

          <p className="text-xs text-asphalt-muted font-sans pt-1">
            Official ranking requires a minimum threshold of 10 closed complaints per ward to ensure statistical significance.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Ranked Ward List Table Plate */}
        <div className="bg-white border border-border rounded-control overflow-hidden">
          <div className="px-4 py-3 bg-kerb/50 border-b border-border flex items-center justify-between text-xs font-heading font-bold text-asphalt">
            <span>Ward Rankings</span>
            <span className="text-[11px] font-normal text-asphalt-muted">
              {ranking.length} pilot wards evaluated
            </span>
          </div>

          <div className="divide-y divide-border">
            {ranking.map((ward) => {
              const hasRank = ward.rank !== null && ward.hasEnoughData;

              return (
                <div key={ward.wardId} className="p-4 sm:p-5 hover:bg-kerb/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Left: Rank & Ward Identifiers */}
                    <div className="flex items-start sm:items-center gap-3">
                      <div
                        className={`w-9 h-9 shrink-0 rounded-plate flex items-center justify-center font-heading font-bold text-sm border ${
                          hasRank && ward.rank === 1
                            ? 'bg-marking-yellow border-asphalt text-asphalt shadow-sm'
                            : hasRank && ward.rank === 2
                            ? 'bg-kerb border-border text-asphalt'
                            : hasRank
                            ? 'bg-white border-border text-asphalt-muted'
                            : 'bg-kerb border-border text-asphalt-subtle'
                        }`}
                      >
                        {hasRank ? `#${ward.rank}` : '—'}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-heading font-bold text-base text-asphalt">
                            {ward.name}
                          </h2>
                          <span className="px-1.5 py-0.2 rounded-plate bg-kerb border border-border text-[11px] font-mono text-asphalt-muted">
                            {ward.code}
                          </span>
                        </div>
                        <p className="text-xs text-asphalt-muted font-sans">
                          {ward.corporation}
                        </p>
                      </div>
                    </div>

                    {/* Right: CTI Score & Overdue Open Rate beside it */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                      {/* CTI Score + Sample size */}
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] uppercase font-heading font-bold tracking-wider text-asphalt-muted block">
                          Civic Trust Index
                        </span>
                        {ward.hasEnoughData && ward.ctiScore !== null ? (
                          <div className="flex items-baseline gap-1.5 sm:justify-end">
                            <span className="text-xl font-heading font-black text-asphalt">
                              {ward.ctiScore}
                            </span>
                            <span className="text-xs font-heading font-semibold text-asphalt-muted">
                              / 100
                            </span>
                            <span className="text-xs font-sans text-asphalt-muted">
                              ({ward.closedCount} closed)
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="px-2 py-0.5 rounded-plate bg-kerb border border-border text-[11px] font-heading font-semibold text-asphalt-muted">
                              Not enough data
                            </span>
                            <span className="text-xs font-sans text-asphalt-subtle">
                              ({ward.closedCount} of 10 closed)
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Overdue Open Rate beside CTI */}
                      <div className="text-left sm:text-right pl-3 border-l border-border">
                        <span className="text-[10px] uppercase font-heading font-bold tracking-wider text-asphalt-muted block">
                          Overdue Open Rate
                        </span>
                        <div className="pt-0.5">
                          {ward.overdueOpenRate !== null ? (
                            <span
                              className={`text-xs font-heading font-bold px-1.5 py-0.5 rounded-plate border ${
                                ward.overdueOpenRate > 0
                                  ? 'bg-alert-red/10 border-alert-red/30 text-alert-red'
                                  : 'bg-fixed-green/10 border-fixed-green/30 text-fixed-green'
                              }`}
                            >
                              {ward.overdueOpenRate}% overdue ({ward.overdueOpenCount} of {ward.openCount} open)
                            </span>
                          ) : (
                            <span className="text-xs font-sans text-asphalt-muted">
                              0% (0 open)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Citizen-Verified and Auto-Closed Counts Side by Side */}
                  <div className="mt-3 pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between text-xs text-asphalt-muted font-sans gap-2">
                    <div className="flex items-center gap-4">
                      <span>
                        <strong className="font-heading text-asphalt font-semibold">
                          Citizen verified:
                        </strong>{' '}
                        {ward.citizenVerifiedCount}
                      </span>
                      <span className="text-border">|</span>
                      <span>
                        <strong className="font-heading text-asphalt font-semibold">
                          Auto-closed:
                        </strong>{' '}
                        {ward.autoClosedCount}
                      </span>
                      {ward.reopenedCount > 0 && (
                        <>
                          <span className="text-border">|</span>
                          <span className="text-alert-red">
                            <strong className="font-heading font-semibold">Contested:</strong>{' '}
                            {ward.reopenedCount}
                          </span>
                        </>
                      )}
                    </div>

                    {ward.participationRate !== null && (
                      <div className="text-[11px] text-asphalt-muted font-heading">
                        Citizen participation:{' '}
                        <strong className="text-asphalt font-bold">
                          {ward.participationRate}%
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Informational Invariant Footnote */}
        <div className="p-4 bg-white border border-border rounded-control text-xs font-sans text-asphalt-muted space-y-1">
          <p className="font-heading font-bold text-asphalt flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-signboard-blue" />
            <span>CTI Formula &amp; Denominator Standards</span>
          </p>
          <p className="leading-relaxed">
            <code>CTI = round(100 &times; [0.4 &times; VerifiedRate + 0.4 &times; max(0, 1 - ReopenRate) + 0.2 &times; SLAComplianceRate])</code>
          </p>
          <p className="text-[11px] text-asphalt-subtle pt-0.5">
            Denominator strictly uses closed complaints (Citizen Verified + Auto Closed). Reopened tickets contribute to the reopen penalty upon resolution. Tickets with no assigned ward are routed through admin triage and excluded from ward metrics.
          </p>
        </div>
      </div>
    </div>
  );
}
