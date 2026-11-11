'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  MapPin,
  Clock,
  ThumbsUp,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Camera,
  User,
  ArrowLeft,
  Loader2,
  Calendar,
  AlertOctagon,
  Sparkles,
} from 'lucide-react';

export default function ComplaintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const complaintId = params.id as string;

  const [complaint, setComplaint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upvote state
  const [upvoting, setUpvoting] = useState(false);
  const [hasUpvoted, setHasUpvoted] = useState(false);

  // Verification modal states
  const [showContestModal, setShowContestModal] = useState(false);
  const [contestRemarks, setContestRemarks] = useState('');
  const [contestImageUrl, setContestImageUrl] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  const fetchComplaint = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/complaints/${complaintId}`);
      if (!res.ok) throw new Error('Complaint not found');
      const data = await res.json();
      setComplaint(data.complaint);

      // Check upvote status
      const voteRes = await fetch(`/api/complaints/${complaintId}/upvote`);
      if (voteRes.ok) {
        const voteData = await voteRes.json();
        setHasUpvoted(voteData.hasUpvoted);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load complaint');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (complaintId) {
      fetchComplaint();
    }
  }, [complaintId]);

  const handleUpvote = async () => {
    setUpvoting(true);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok) {
        setComplaint((prev: any) => ({
          ...prev,
          upvotesCount: data.upvotesCount,
        }));
        setHasUpvoted(true);
      } else if (res.status === 409) {
        setHasUpvoted(true);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to upvote');
    } finally {
      setUpvoting(false);
    }
  };

  const handleConfirmResolution = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', remarks: 'Confirmed by citizen audit' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setVerifyMessage('Resolution confirmed! Ticket marked as Resolved - Citizen Verified.');
      fetchComplaint();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleContestResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contestRemarks) {
      alert('Please explain why the resolution is incomplete or unsatisfactory.');
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'contest',
          remarks: contestRemarks,
          imageUrl: contestImageUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowContestModal(false);
      setContestRemarks('');
      setVerifyMessage(data.message);
      fetchComplaint();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
          <p className="text-sm font-semibold text-slate-600">Loading complaint details...</p>
        </div>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-2xl font-bold text-slate-900">Complaint Not Found</h2>
        <p className="text-sm text-slate-600">{error || 'This record does not exist.'}</p>
        <button
          onClick={() => router.push('/explore')}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Civic Map</span>
        </button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'In Progress':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Pending Verification':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Resolved - Citizen Verified':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Resolved - Auto Closed':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      case 'Reopened - Escalated':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Disputed - Admin Review':
        return 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 sm:px-6">
      {/* Back button & top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-500">Ward:</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
            {complaint.wardId?.name} ({complaint.wardId?.code})
          </span>
          {complaint.agencyId && (
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              {complaint.agencyId.shortName}
            </span>
          )}
        </div>
      </div>

      {verifyMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold flex items-center space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{verifyMessage}</span>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs uppercase font-extrabold px-3 py-1 rounded-full border ${getStatusBadge(
                  complaint.status
                )}`}
              >
                {complaint.status}
              </span>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {complaint.category}
              </span>
              {complaint.reopenCount > 0 && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  Dispute Count: {complaint.reopenCount}/2
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {complaint.title}
            </h1>

            <p className="text-xs text-slate-500 flex items-center space-x-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{complaint.address}</span>
            </p>
          </div>

          {/* Upvote Button */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleUpvote}
              disabled={upvoting || hasUpvoted}
              className={`flex items-center space-x-2 px-5 py-3 rounded-2xl font-bold text-sm shadow-sm transition ${
                hasUpvoted
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                  : 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20 hover:scale-[1.02]'
              }`}
            >
              <ThumbsUp className={`w-4 h-4 ${hasUpvoted ? 'text-emerald-600' : 'text-white'}`} />
              <span>{hasUpvoted ? 'Upvoted' : 'Upvote Issue'}</span>
              <span className="bg-black/15 px-2 py-0.5 rounded-full text-xs font-black">
                {complaint.upvotesCount}
              </span>
            </button>
          </div>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
          {complaint.description}
        </p>

        {/* 120-Hour Citizen Audit Alert & Actions */}
        {complaint.status === 'Pending Verification' && (
          <div className="p-6 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-blue-900">
                    5-Day Citizen Verification Audit Window
                  </h3>
                  <p className="text-xs text-blue-700 mt-0.5">
                    Field officer marked this resolved with GPS lock. As a citizen, you have 120 hours to confirm the fix or contest it.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
                  Reopen Limit
                </span>
                <span className="text-xs font-black text-blue-900">
                  {complaint.reopenCount} / 2 Used
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleConfirmResolution}
                disabled={verifying}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm Fix (Resolution Satisfactory)</span>
              </button>

              <button
                onClick={() => setShowContestModal(true)}
                disabled={verifying}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition"
              >
                <AlertOctagon className="w-4 h-4" />
                <span>Contest / Reopen Ticket</span>
              </button>
            </div>
          </div>
        )}

        {/* Disputed Circuit Breaker Alert */}
        {complaint.status === 'Disputed - Admin Review' && (
          <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start space-x-3">
            <AlertOctagon className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-rose-900">Dispute Circuit Breaker Active</h3>
              <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                This ticket has been contested 3 times by citizens. Automated reopen loop is locked and the ticket has been escalated directly to Municipal Commissioner Admin Review.
              </p>
            </div>
          </div>
        )}

        {/* Before / After Photo Comparison Viewer */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Field Evidence & Resolution Verification
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Before Photo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span>Reported Condition (Before)</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(complaint.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video relative">
                <img
                  src={complaint.imageUrl}
                  alt="Before"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* After Photo */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Field Officer Resolution Proof (After)</span>
                </span>
                {complaint.resolutionImageUrl && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    GPS-Verified Lock
                  </span>
                )}
              </div>

              {complaint.resolutionImageUrl ? (
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video relative">
                  <img
                    src={complaint.resolutionImageUrl}
                    alt="After"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 aspect-video flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                  <Clock className="w-8 h-8 mb-2 text-slate-300" />
                  <p className="text-xs font-bold text-slate-500">Awaiting Field Officer Resolution</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Officer must verify location within allowed GPS radius.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Append-Only Status Audit Timeline */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Append-Only Audit Timeline ({complaint.statusHistory?.length || 0} Events)
          </h2>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {complaint.statusHistory?.map((event: any, idx: number) => (
              <div key={idx} className="relative group">
                <div className="absolute -left-6 mt-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-slate-900 shadow-sm" />

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900">
                        {event.actorId?.name || (event.role === 'citizen' ? 'Citizen' : 'Officer')}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                        {event.role}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getStatusBadge(
                        event.status
                      )}`}
                    >
                      {event.status}
                    </span>
                    {event.resolutionDistanceMeters !== undefined && (
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                        GPS Proximity: {event.resolutionDistanceMeters}m (Acc: ±{event.locationAccuracy}m)
                      </span>
                    )}
                  </div>

                  {event.remarks && (
                    <p className="text-xs text-slate-600 leading-relaxed">{event.remarks}</p>
                  )}

                  {event.imageUrl && (
                    <div className="mt-2 w-32 h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                      <img
                        src={event.imageUrl}
                        alt="Audit Attachment"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contest Modal */}
      {showContestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl border border-slate-200">
            <div>
              <div className="inline-flex items-center space-x-1 text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full uppercase mb-2">
                <span>Dispute #{complaint.reopenCount + 1}</span>
                <span>&bull;</span>
                <span>Max 2 Allowed</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                Contest Resolution & Reopen Ticket
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Provide detailed feedback on why this civic issue is still unresolved.
              </p>
            </div>

            {complaint.reopenCount >= 2 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                ⚠️ Circuit Breaker Warning: This will be the 3rd contest. The ticket will automatically escalate to <b>Disputed - Admin Review</b> for commissioner intervention.
              </div>
            )}

            <form onSubmit={handleContestResolution} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">Remarks / Reason</label>
                <textarea
                  value={contestRemarks}
                  onChange={(e) => setContestRemarks(e.target.value)}
                  rows={3}
                  placeholder="e.g. The pothole was merely filled with loose debris that washed away in rainfall..."
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Contest Photo Proof URL (Optional)</label>
                <input
                  type="url"
                  value={contestImageUrl}
                  onChange={(e) => setContestImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or data URL"
                  className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowContestModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifying}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition disabled:opacity-50"
                >
                  {verifying ? 'Submitting Dispute...' : 'Confirm Dispute & Reopen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
