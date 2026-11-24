'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import {
  ChevronLeft,
  MapPin,
  ThumbsUp,
  AlertCircle,
  CheckCircle2,
  Share2,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ExternalLink,
  Pencil,
  Trash2,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { BeforeAfterSlider } from '@/components/ui/BeforeAfterSlider';
import { Timeline } from '@/components/ui/Timeline';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { useTranslation } from '@/lib/i18n';

export default function ComplaintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { t } = useTranslation();
  const complaintId = params.id as string;

  const [complaint, setComplaint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upvote state
  const [upvoting, setUpvoting] = useState(false);
  const [hasUpvoted, setHasUpvoted] = useState(false);

  // Verification audit states
  const [showContestSheet, setShowContestSheet] = useState(false);
  const [contestRemarks, setContestRemarks] = useState('');
  const [contestImageUrl, setContestImageUrl] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Edit & Delete modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<string>('Roads');
  const [editDescription, setEditDescription] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchComplaint = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/complaints/${complaintId}`);
      if (!res.ok) throw new Error('Complaint not found.');
      const data = await res.json();
      setComplaint(data.complaint);

      // Check user upvote state
      const voteRes = await fetch(`/api/complaints/${complaintId}/upvote`);
      if (voteRes.ok) {
        const voteData = await voteRes.json();
        setHasUpvoted(voteData.hasUpvoted);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load complaint.');
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

  useEffect(() => {
    if (complaintId) {
      fetchComplaint();
    }
  }, [complaintId, fetchComplaint]);

  // Support / Upvote
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
      alert(err.message || 'Failed to support report.');
    } finally {
      setUpvoting(false);
    }
  };

  // Confirm Fix
  const handleConfirmResolution = async () => {
    setVerifying(true);
    setFeedbackNotice(null);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', remarks: 'Confirmed by citizen audit' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedbackNotice('Resolution confirmed. Ticket is now Resolved - Citizen verified.');
      fetchComplaint();
    } catch (err: any) {
      alert(err.message || 'Failed to verify.');
    } finally {
      setVerifying(false);
    }
  };

  // Contest / Reopen Fix
  const handleContestResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contestRemarks.trim()) {
      alert('Please explain what is still broken or incomplete.');
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'contest',
          remarks: contestRemarks.trim(),
          imageUrl: contestImageUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowContestSheet(false);
      setContestRemarks('');
      setContestImageUrl('');
      setFeedbackNotice(data.message);
      fetchComplaint();
    } catch (err: any) {
      alert(err.message || 'Failed to contest.');
    } finally {
      setVerifying(false);
    }
  };

  // Authorization checks for Edit & Delete
  const currentUserId = (session?.user as any)?.id;
  const userRole = (session?.user as any)?.role;
  const userWardId = (session?.user as any)?.assignedWardId;

  const complaintReportedById = complaint?.reportedBy?._id || complaint?.reportedBy;
  const complaintWardId = complaint?.wardId?._id || complaint?.wardId;

  const isOwner = Boolean(
    currentUserId &&
    (complaintReportedById === currentUserId ||
     (session?.user?.email && complaint?.reportedBy?.email === session?.user?.email))
  );
  const isAdmin = userRole === 'admin';
  const isAssignedOfficer =
    userRole === 'officer' &&
    Boolean(
      (userWardId && complaintWardId && (complaintWardId === userWardId || complaintWardId?._id === userWardId)) ||
      isOwner
    );

  const canEditOrDelete = isAdmin || isOwner || isAssignedOfficer;

  const handleOpenEditModal = () => {
    if (!complaint) return;
    setEditTitle(complaint.title || '');
    setEditCategory(complaint.category || 'Roads');
    setEditDescription(complaint.description || '');
    setEditAddress(complaint.address || '');
    setActionError(null);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/complaints/${complaintId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          category: editCategory,
          description: editDescription.trim(),
          address: editAddress.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update complaint');

      setComplaint(data.complaint);
      setShowEditModal(false);
      setFeedbackNotice('Complaint updated successfully.');
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleConfirmDelete = async () => {
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/complaints/${complaintId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete complaint');

      setShowDeleteModal(false);
      router.push('/my-complaints');
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="w-24 h-8" />
        <Skeleton className="w-full h-12" />
        <Skeleton variant="map" className="h-64" />
        <Skeleton variant="row" />
        <Skeleton variant="row" />
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-control bg-alert-light border border-alert-red/30 flex items-center justify-center text-alert-red">
          <AlertCircle className="w-6 h-6 stroke-[2]" />
        </div>
        <h2 className="text-lg font-heading font-bold text-asphalt">
          Complaint not found
        </h2>
        <p className="text-xs text-asphalt-muted leading-relaxed">
          {error || 'The requested civic issue record does not exist or has been removed.'}
        </p>
        <div>
          <Button variant="secondary" onClick={() => router.push('/explore')}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            <span>Return to map</span>
          </Button>
        </div>
      </div>
    );
  }

  // Calculate remaining audit days if in verification window
  let remainingAuditDays = 5;
  if (complaint.verificationDeadline) {
    const diffMs = new Date(complaint.verificationDeadline).getTime() - Date.now();
    remainingAuditDays = Math.max(0, Math.ceil(diffMs / (24 * 3600 * 1000)));
  }

  // Find latest officer resolution event for BeforeAfter dates
  const officerResolveEvent = Array.isArray(complaint.statusHistory)
    ? [...complaint.statusHistory].reverse().find(
        (e: any) =>
          e.status === 'Pending Verification' ||
          (e.role === 'officer' && String(e.status).startsWith('Resolved'))
      )
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* 1. TOP BAR: Back Navigation + Ward/Agency Tag */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 min-h-[38px] px-2.5 py-1 text-xs font-heading font-semibold text-asphalt bg-white hover:bg-kerb rounded-control border border-border transition-colors"
        >
          <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          <span>{t.back}</span>
        </button>

        <div className="flex items-center gap-2">
          {complaint.wardId && (
            <span className="px-2 py-0.5 rounded-plate bg-white text-asphalt font-heading font-bold text-xs border border-border">
              {complaint.wardId.name} ({complaint.wardId.code})
            </span>
          )}
          {complaint.agencyId && (
            <span className="px-2 py-0.5 rounded-plate bg-signboard-light text-signboard-blue font-heading font-bold text-xs border border-signboard-blue/30">
              {complaint.agencyId.shortName}
            </span>
          )}
        </div>
      </div>

      {/* Global Notice Banner */}
      {feedbackNotice && (
        <div className="p-3 bg-fixed-light border border-fixed-green/40 rounded-control flex items-center gap-2 text-xs text-fixed-green font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackNotice}</span>
        </div>
      )}

      {/* 2. HEADER PLATE: Status Badge, Title, Address */}
      <div className="bg-white p-5 rounded-control border border-border space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <StatusBadge status={complaint.status} />
            <span className="text-xs font-heading font-semibold text-asphalt-muted px-2 py-0.5 bg-kerb rounded-plate border border-border-subtle">
              {complaint.category}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {complaint.reopenCount > 0 && (
              <span className="text-[11px] font-heading font-bold px-2 py-0.5 rounded-plate bg-alert-light text-alert-red border border-alert-red/30">
                Disputes: {complaint.reopenCount} / 2
              </span>
            )}
            {canEditOrDelete && (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleOpenEditModal}
                  className="flex items-center gap-1 text-xs px-2.5 py-1"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setShowDeleteModal(true);
                    setActionError(null);
                  }}
                  className="flex items-center gap-1 text-xs px-2.5 py-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        <h1 className="text-xl sm:text-2xl font-heading font-bold text-asphalt leading-tight">
          {complaint.title}
        </h1>

        <div className="flex items-center gap-1.5 text-xs text-asphalt-muted">
          <MapPin className="w-3.5 h-3.5 text-signboard-blue shrink-0" />
          <span className="truncate">{complaint.address}</span>
        </div>

        {complaint.description && (
          <p className="text-xs text-asphalt leading-relaxed pt-2 border-t border-border-subtle">
            {complaint.description}
          </p>
        )}
      </div>

      {/* 3. SIGNATURE ELEMENT: BEFORE & AFTER SLIDER (FIRST, PROMINENT) */}
      <div className="bg-white p-4 sm:p-5 rounded-control border border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-heading font-bold text-asphalt flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-marking-yellow border border-asphalt" />
            <span>Before and after fix</span>
          </h2>
          <span className="text-[11px] text-asphalt-muted">
            {complaint.resolutionImageUrl ? 'Drag slider or use arrow keys' : 'Reported issue photo'}
          </span>
        </div>

        {complaint.resolutionImageUrl ? (
          <BeforeAfterSlider
            beforeUrl={complaint.imageUrl}
            afterUrl={complaint.resolutionImageUrl}
            beforeDate={complaint.createdAt}
            afterDate={officerResolveEvent?.timestamp || complaint.updatedAt}
            beforeAuthor={complaint.reportedBy?.name || 'Citizen'}
            afterAuthor="Field Officer"
          />
        ) : (
          <div className="space-y-2">
            <div className="relative w-full aspect-[16/10] rounded-control overflow-hidden border border-border bg-asphalt">
              <Image
                src={complaint.imageUrl}
                alt="Reported problem condition"
                fill
                sizes="(max-width: 768px) 100vw, 700px"
                className="object-cover"
                priority
                unoptimized={complaint.imageUrl.startsWith('data:')}
              />
              <span className="absolute top-3 left-3 px-2 py-0.5 rounded-plate bg-asphalt/85 text-white font-heading font-semibold text-xs border border-white/20">
                {t.before}
              </span>
            </div>
            <div className="flex justify-between text-xs text-asphalt-muted px-1">
              <span>Reported on {new Date(complaint.createdAt).toLocaleDateString('en-IN')}</span>
              <span>Awaiting officer on-site resolution proof</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. CITIZEN AUDIT OR DISPUTE CIRCUIT BREAKER */}
      {complaint.status === 'Pending Verification' && (
        <div className="bg-white p-5 rounded-control border-2 border-signboard-blue space-y-3.5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-plate bg-signboard-light border border-signboard-blue/40 flex items-center justify-center text-signboard-blue shrink-0">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-heading font-bold text-asphalt">
                {t.citizenAuditTitle}
              </h3>
              <p className="text-xs text-asphalt-muted mt-0.5 leading-relaxed">
                {t.citizenAuditSubtitle(remainingAuditDays)}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <Button
              variant="primary"
              size="md"
              disabled={verifying}
              onClick={handleConfirmResolution}
              className="flex-1"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5 stroke-[2.5]" />
              <span>{t.yesFixed}</span>
            </Button>

            <Button
              variant="destructive"
              size="md"
              disabled={verifying}
              onClick={() => setShowContestSheet(true)}
              className="flex-1"
            >
              <AlertTriangle className="w-4 h-4 mr-1.5 stroke-[2.5]" />
              <span>{t.notFixed}</span>
            </Button>
          </div>
        </div>
      )}

      {complaint.status === 'Disputed - Admin Review' && (
        <div className="p-4 bg-alert-light border border-alert-red/40 rounded-control flex items-start gap-3 text-xs text-alert-red">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-heading font-bold text-sm">Dispute circuit breaker active</p>
            <p className="mt-0.5 leading-relaxed">
              This issue was contested multiple times. It is locked in the municipal administration triage queue for commissioner arbitration.
            </p>
          </div>
        </div>
      )}

      {/* 5. CITIZEN ACTIONS: SUPPORT / SHARE */}
      <div className="bg-white p-4 rounded-control border border-border flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-heading font-bold text-asphalt block">
            Community priority
          </span>
          <span className="text-xs text-asphalt-muted">
            {complaint.upvotesCount} citizens supported this issue
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={hasUpvoted ? 'secondary' : 'primary'}
            size="md"
            disabled={upvoting || hasUpvoted}
            onClick={handleUpvote}
          >
            <ThumbsUp className={`w-4 h-4 mr-1.5 ${hasUpvoted ? 'fill-asphalt text-asphalt' : ''}`} />
            <span>{hasUpvoted ? t.supported : t.supportReport}</span>
          </Button>
        </div>
      </div>

      {/* 6. SIGNATURE ELEMENT: TIMELINE (ROAD CENTRE-LINE MOTIF) */}
      <div className="bg-white p-5 rounded-control border border-border space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <h2 className="text-sm font-heading font-bold text-asphalt">
            {t.timelineTitle}
          </h2>
          <span className="text-[11px] text-asphalt-muted">
            Append-only audit trail
          </span>
        </div>

        <Timeline
          statusHistory={complaint.statusHistory || []}
          currentStatus={complaint.status}
        />
      </div>

      {/* Contest Reopen Bottom Sheet */}
      <BottomSheet
        isOpen={showContestSheet}
        onClose={() => setShowContestSheet(false)}
        title="Contest resolution (Issue not fixed)"
      >
        <form onSubmit={handleContestResolution} className="space-y-4 py-2">
          <p className="text-xs text-asphalt-muted leading-relaxed">
            Explain what remains broken or why the officer&apos;s fix is incomplete. Your dispute will re-escalate the complaint.
          </p>

          <div>
            <label className="block text-xs font-heading font-bold text-asphalt mb-1">
              Dispute explanation (required)
            </label>
            <textarea
              value={contestRemarks}
              onChange={(e) => setContestRemarks(e.target.value)}
              rows={3}
              placeholder="e.g. The drain slab was placed loosely and rocks when walked on..."
              className="w-full px-3 py-2 text-xs rounded-control border border-border bg-white text-asphalt focus:border-signboard-blue resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-heading font-bold text-asphalt mb-1">
              Photo URL proof (optional)
            </label>
            <input
              type="url"
              value={contestImageUrl}
              onChange={(e) => setContestImageUrl(e.target.value)}
              placeholder="https://res.cloudinary.com/..."
              className="w-full px-3 py-2 text-xs rounded-control border border-border bg-white text-asphalt focus:border-signboard-blue"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setShowContestSheet(false)}
            >
              {t.cancel}
            </Button>

            <Button
              type="submit"
              variant="destructive"
              fullWidth
              disabled={verifying || !contestRemarks.trim()}
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  <span>Submitting dispute...</span>
                </>
              ) : (
                <span>Submit dispute &amp; reopen</span>
              )}
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* Edit Complaint Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          if (!submittingAction) {
            setShowEditModal(false);
            setActionError(null);
          }
        }}
        title="Edit Complaint Details"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {actionError && (
            <div className="p-2.5 rounded-plate bg-alert-light border border-alert-red/30 text-xs text-alert-red flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-heading font-bold text-asphalt mb-1">
              Title <span className="text-alert-red">*</span>
            </label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={150}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Brief summary of the issue"
              className="w-full px-3 py-2 text-xs font-sans rounded-control border border-border bg-white text-asphalt focus:outline-none focus:ring-1 focus:ring-signboard-blue"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-heading font-bold text-asphalt mb-1">
                Category <span className="text-alert-red">*</span>
              </label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs font-heading font-semibold rounded-control border border-border bg-white text-asphalt focus:outline-none focus:ring-1 focus:ring-signboard-blue"
              >
                <option value="Roads">Roads</option>
                <option value="Sanitation">Sanitation</option>
                <option value="Streetlights">Streetlights</option>
                <option value="Water Supply & Drainage">Water Supply & Drainage</option>
                <option value="Others">Others</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-heading font-bold text-asphalt mb-1">
                Location / Address
              </label>
              <input
                type="text"
                maxLength={300}
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="Street name, landmark"
                className="w-full px-3 py-2 text-xs font-sans rounded-control border border-border bg-white text-asphalt focus:outline-none focus:ring-1 focus:ring-signboard-blue"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-heading font-bold text-asphalt mb-1">
              Description <span className="text-alert-red">*</span>
            </label>
            <textarea
              required
              minLength={5}
              maxLength={2000}
              rows={4}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Describe the problem, severity, and any hazards..."
              className="w-full px-3 py-2 text-xs font-sans rounded-control border border-border bg-white text-asphalt focus:outline-none focus:ring-1 focus:ring-signboard-blue resize-none"
            />
            <span className="text-[10px] text-asphalt-muted font-sans mt-0.5 block text-right">
              {editDescription.length} / 2000
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowEditModal(false);
                setActionError(null);
              }}
              disabled={submittingAction}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submittingAction || editTitle.trim().length < 3 || editDescription.trim().length < 5}
            >
              {submittingAction ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Complaint Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          if (!submittingAction) {
            setShowDeleteModal(false);
            setActionError(null);
          }
        }}
        title="Delete Complaint"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          {actionError && (
            <div className="p-2.5 rounded-plate bg-alert-light border border-alert-red/30 text-xs text-alert-red flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          <p className="text-xs text-asphalt-muted leading-relaxed">
            Are you sure you want to permanently delete{' '}
            <strong className="text-asphalt font-semibold">&quot;{complaint?.title}&quot;</strong>?
            This action will remove the complaint and all associated votes. This cannot be undone.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowDeleteModal(false);
                setActionError(null);
              }}
              disabled={submittingAction}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={submittingAction}
            >
              {submittingAction ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <span>Confirm Delete</span>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
