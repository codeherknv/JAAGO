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
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { ComplaintRow } from '@/components/ui/ComplaintRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';

export default function MyComplaintsPage() {
  const { data: session, status: authStatus } = useSession();
  const { t } = useTranslation();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Edit & Delete states
  const [editingComplaint, setEditingComplaint] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<string>('Roads');
  const [editDescription, setEditDescription] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [deletingComplaint, setDeletingComplaint] = useState<any | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleOpenEdit = (c: any) => {
    setEditingComplaint(c);
    setEditTitle(c.title || '');
    setEditCategory(c.category || 'Roads');
    setEditDescription(c.description || '');
    setEditAddress(c.address || '');
    setActionError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComplaint) return;
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/complaints/${editingComplaint._id}`, {
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

      setComplaints((prev) =>
        prev.map((item) => (item._id === editingComplaint._id ? { ...item, ...data.complaint } : item))
      );
      setEditingComplaint(null);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingComplaint) return;
    setSubmittingAction(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/complaints/${deletingComplaint._id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete complaint');

      setComplaints((prev) => prev.filter((item) => item._id !== deletingComplaint._id));
      setDeletingComplaint(null);
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

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
                    actionButton={
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(c)}
                          className="px-2 py-1 rounded-control text-xs font-heading font-semibold text-asphalt bg-white border border-border hover:bg-kerb transition-colors flex items-center gap-1"
                          title="Edit Complaint"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingComplaint(c);
                            setActionError(null);
                          }}
                          className="px-2 py-1 rounded-control text-xs font-heading font-semibold text-alert-red bg-alert-light/60 border border-alert-red/30 hover:bg-alert-light transition-colors flex items-center gap-1"
                          title="Delete Complaint"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      </div>
                    }
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

      {/* Edit Complaint Modal */}
      <Modal
        isOpen={Boolean(editingComplaint)}
        onClose={() => {
          if (!submittingAction) {
            setEditingComplaint(null);
            setActionError(null);
          }
        }}
        title="Edit Complaint Details"
        maxWidth="max-w-lg"
      >
        {editingComplaint && (
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
                  setEditingComplaint(null);
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
        )}
      </Modal>

      {/* Delete Complaint Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingComplaint)}
        onClose={() => {
          if (!submittingAction) {
            setDeletingComplaint(null);
            setActionError(null);
          }
        }}
        title="Delete Complaint"
        maxWidth="max-w-md"
      >
        {deletingComplaint && (
          <div className="space-y-4">
            {actionError && (
              <div className="p-2.5 rounded-plate bg-alert-light border border-alert-red/30 text-xs text-alert-red flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <p className="text-xs text-asphalt-muted leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-asphalt font-semibold">&quot;{deletingComplaint.title}&quot;</strong>?
              This action will remove the complaint and all associated votes. This cannot be undone.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDeletingComplaint(null);
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
        )}
      </Modal>
    </div>
  );
}
