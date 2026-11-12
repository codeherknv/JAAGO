'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  FileText,
  Clock,
  RefreshCw,
  Plus,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { ComplaintRow } from '@/components/ui/ComplaintRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

export default function MyComplaintsPage() {
  const { data: session, status: authStatus } = useSession();
  const { t } = useTranslation();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const fetchMyComplaints = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/complaints/my');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to fetch your complaints');
      }
      const data = await res.json();
      setComplaints(data.complaints || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchMyComplaints();
    } else if (authStatus === 'unauthenticated') {
      setLoading(false);
    }
  }, [authStatus]);

  if (authStatus === 'loading') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-4">
        <Skeleton variant="text" className="w-48 h-6" />
        <Skeleton variant="text" className="w-3/4 h-8" />
        <div className="space-y-3 mt-6">
          <Skeleton variant="row" />
          <Skeleton variant="row" />
          <Skeleton variant="row" />
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-white rounded-control border border-border shadow-sheet text-center space-y-4">
        <div className="w-12 h-12 rounded-control bg-kerb text-asphalt flex items-center justify-center mx-auto border border-border">
          <FileText className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-heading font-black text-asphalt">Sign In Required</h2>
        <p className="text-xs font-sans text-asphalt-muted leading-relaxed">
          Sign in to view your filed complaints, track municipal repair timelines, and participate in resolution verification.
        </p>
        <Link href="/login?callbackUrl=/my-complaints" className="block w-full">
          <Button variant="primary" className="w-full">
            Sign In / Demo Login
          </Button>
        </Link>
      </div>
    );
  }

  const unroutedCount = complaints.filter((c) => !c.wardId).length;
  const pendingVerificationCount = complaints.filter(
    (c) => c.status === 'Pending Verification'
  ).length;
  const resolvedCount = complaints.filter((c) => c.status?.startsWith('Resolved')).length;

  // Filter complaints
  const filteredComplaints = complaints.filter((c) => {
    if (statusFilter === 'unrouted') {
      if (c.wardId) return false;
    } else if (statusFilter !== 'all') {
      if (statusFilter === 'Resolved') {
        if (!c.status?.startsWith('Resolved')) return false;
      } else if (c.status !== statusFilter) {
        return false;
      }
    }

    if (categoryFilter !== 'all' && c.category !== categoryFilter) {
      return false;
    }

    return true;
  });

  return (
    <div className="w-full bg-kerb min-h-[calc(100vh-64px)] pb-20 md:pb-12">
      {/* Top Header Plate */}
      <div className="bg-white border-b border-border py-6 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-plate bg-signboard-blue text-white text-[11px] font-heading font-bold">
                Citizen Portal
              </span>
              <span className="text-xs text-asphalt-muted font-sans">
                {session?.user?.email}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-asphalt tracking-tight">
              {t.myComplaints}
            </h1>
            <p className="text-xs text-asphalt-muted font-sans mt-0.5">
              Track issues you reported and confirm resolutions on site.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchMyComplaints}
              disabled={loading}
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Link href="/report">
              <Button variant="primary" size="sm" className="flex items-center gap-1.5">
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>{t.reportProblem}</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Metric Plates */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-white border border-border rounded-control">
            <span className="text-[10px] uppercase font-heading font-bold tracking-wider text-asphalt-muted block">
              Total Filed
            </span>
            <span className="text-xl font-heading font-black text-asphalt mt-0.5 block">
              {complaints.length}
            </span>
          </div>

          <div className="p-3 bg-white border border-border rounded-control">
            <span className="text-[10px] uppercase font-heading font-bold tracking-wider text-signboard-blue block">
              In Verification
            </span>
            <span className="text-xl font-heading font-black text-signboard-blue mt-0.5 block">
              {pendingVerificationCount}
            </span>
          </div>

          <div className="p-3 bg-white border border-border rounded-control">
            <span className="text-[10px] uppercase font-heading font-bold tracking-wider text-fixed-green block">
              Resolved
            </span>
            <span className="text-xl font-heading font-black text-fixed-green mt-0.5 block">
              {resolvedCount}
            </span>
          </div>

          <div className="p-3 bg-white border border-border rounded-control">
            <span className="text-[10px] uppercase font-heading font-bold tracking-wider text-marking-yellow block">
              Waiting for Routing
            </span>
            <span className="text-xl font-heading font-black text-asphalt mt-0.5 block">
              {unroutedCount}
            </span>
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-white rounded-control border border-border">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto max-w-full">
            {[
              { id: 'all', label: 'All' },
              { id: 'unrouted', label: 'Waiting for routing' },
              { id: 'Pending', label: 'Pending' },
              { id: 'In Progress', label: 'In Progress' },
              { id: 'Pending Verification', label: 'Pending Verification' },
              { id: 'Resolved', label: 'Resolved' },
            ].map((f) => {
              const active = statusFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-2.5 py-1 rounded-plate text-xs font-heading font-semibold transition ${
                    active
                      ? 'bg-asphalt text-marking-yellow'
                      : 'bg-kerb text-asphalt-muted hover:bg-border-subtle hover:text-asphalt'
                  }`}
                >
                  {f.label}
                  {f.id === 'unrouted' && unroutedCount > 0 && (
                    <span className="ml-1.5 px-1 rounded-full bg-marking-yellow text-asphalt text-[10px] font-bold">
                      {unroutedCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-2.5 py-1 bg-kerb border border-border rounded-plate text-xs font-heading font-semibold text-asphalt cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="Roads">Roads</option>
            <option value="Sanitation">Sanitation</option>
            <option value="Streetlights">Streetlights</option>
            <option value="Water Supply & Drainage">Water Supply & Drainage</option>
            <option value="Others">Others</option>
          </select>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-3 rounded-plate bg-alert-red/10 border border-alert-red/30 text-xs font-sans text-alert-red flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Complaints Flat Row List */}
        {loading ? (
          <div className="space-y-3">
            <Skeleton variant="row" />
            <Skeleton variant="row" />
            <Skeleton variant="row" />
          </div>
        ) : filteredComplaints.length === 0 ? (
          <EmptyState
            title="No complaints found"
            description={
              statusFilter !== 'all'
                ? 'No filed issues match the selected filter.'
                : "You haven't reported any civic issues yet. Use the report button when you notice road, sanitation, or lighting problems."
            }
            actionLabel={t.reportProblem}
            actionHref="/report"
          />
        ) : (
          <div className="bg-white border border-border rounded-control divide-y divide-border overflow-hidden">
            {filteredComplaints.map((c) => {
              const isUnrouted = !c.wardId;

              return (
                <div key={c._id} className="relative">
                  <ComplaintRow
                    id={c._id}
                    title={c.title}
                    category={c.category}
                    address={
                      isUnrouted
                        ? `${c.address || 'Location geo-tagged'} • Waiting for routing`
                        : c.address || c.wardId?.name
                    }
                    status={c.status}
                    upvotesCount={c.upvotesCount || 0}
                    imageUrl={c.resolutionImageUrl || c.imageUrl}
                  />

                  {/* Explicit Waiting for routing plate */}
                  {isUnrouted && (
                    <div className="absolute top-3 right-4 pointer-events-none hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-plate bg-marking-yellow/20 border border-marking-yellow text-asphalt text-[11px] font-heading font-bold">
                      <Clock className="w-3 h-3 text-asphalt" />
                      <span>{t.waitingForRouting}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
