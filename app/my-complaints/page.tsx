'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  FileText,
  Clock,
  MapPin,
  ThumbsUp,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  PlusCircle,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';

export default function MyComplaintsPage() {
  const { data: session, status: authStatus } = useSession();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
        <p className="text-sm font-semibold text-slate-600">Verifying session...</p>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
          <FileText className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sign In Required</h2>
        <p className="text-sm text-slate-500">
          Please sign in to view your filed complaints, track verification audits, and view municipal resolution progress.
        </p>
        <Link
          href="/login?callbackUrl=/my-complaints"
          className="inline-flex items-center justify-center w-full px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-md shadow-orange-600/25 transition"
        >
          Sign In / Demo Login
        </Link>
      </div>
    );
  }

  const unroutedCount = complaints.filter((c) => !c.wardId).length;
  const pendingVerificationCount = complaints.filter((c) => c.status === 'Pending Verification').length;
  const resolvedCount = complaints.filter((c) => c.status?.startsWith('Resolved')).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-bold uppercase mb-2">
            <FileText className="w-3.5 h-3.5 text-orange-600" />
            <span>Citizen Dashboard</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            My Submitted Complaints
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Real-time tracking of all civic issues you have reported across Greater Bengaluru.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchMyComplaints}
            disabled={loading}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-sm transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/report"
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-600/20 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Report New Issue</span>
          </Link>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Filed</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{complaints.length}</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">In Verification</p>
          <p className="text-2xl font-black text-blue-600 mt-1">{pendingVerificationCount}</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resolved</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{resolvedCount}</p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Waiting for Routing</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{unroutedCount}</p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Complaints List */}
      {loading ? (
        <div className="py-16 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto" />
          <p className="text-sm font-semibold text-slate-500">Loading your complaints...</p>
        </div>
      ) : complaints.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-300 p-8 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No complaints reported yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Notice a pothole, uncollected garbage, or broken streetlight? Report it now with geo-tagged verification.
          </p>
          <Link
            href="/report"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Report Your First Issue</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {complaints.map((c) => {
            const isUnrouted = !c.wardId;
            return (
              <div
                key={c._id}
                className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-xs font-bold">
                      {c.category}
                    </span>

                    {/* Ward Badge or Waiting for Routing Label */}
                    {isUnrouted ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Waiting for routing</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          {c.wardId.name} ({c.wardId.code})
                        </span>
                      </span>
                    )}

                    {/* Status Badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        c.status === 'Pending'
                          ? 'bg-rose-100 text-rose-800'
                          : c.status === 'In Progress'
                          ? 'bg-amber-100 text-amber-800'
                          : c.status === 'Pending Verification'
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : c.status?.startsWith('Resolved')
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-slate-900">{c.title}</h3>
                  <p className="text-xs text-slate-600 line-clamp-2">{c.description}</p>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
                    <span>Filed: {new Date(c.createdAt).toLocaleDateString()}</span>
                    <span>&bull;</span>
                    <span className="flex items-center space-x-1 text-slate-600 font-semibold">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{c.upvotesCount} upvotes</span>
                    </span>
                    {c.agencyId && (
                      <>
                        <span>&bull;</span>
                        <span className="text-slate-600 font-medium">Agency: {c.agencyId.name}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0 self-end md:self-center">
                  <Link
                    href={`/complaints/${c._id}`}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition"
                  >
                    <span>View Ticket</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
