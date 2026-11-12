'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ShieldAlert,
  Users,
  GitPullRequest,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  MapPin,
  Building2,
  Calendar,
  Lock,
  X,
  FileCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';

interface Officer {
  _id: string;
  name: string;
  email: string;
  assignedWardId?: { _id: string; name: string; code: string };
  agencyId?: { _id: string; name: string; shortName: string };
  isActive: boolean;
}

interface Complaint {
  _id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  imageUrl?: string;
  resolutionImageUrl?: string;
  address?: string;
  wardId?: { _id: string; name: string; code: string };
  agencyId?: { _id: string; name: string; shortName: string };
  reportedBy?: { name: string; email: string };
  reopenCount?: number;
  statusHistory?: any[];
  createdAt: string;
}

interface Ward {
  _id: string;
  name: string;
  code: string;
}

interface Agency {
  _id: string;
  name: string;
  shortName: string;
}

export default function AdminDashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const [activeTab, setActiveTab] = useState<'officers' | 'triage' | 'disputes' | 'invalid'>('officers');

  const [officers, setOfficers] = useState<Officer[]>([]);
  const [triageComplaints, setTriageComplaints] = useState<Complaint[]>([]);
  const [disputedComplaints, setDisputedComplaints] = useState<Complaint[]>([]);
  const [allComplaints, setAllComplaints] = useState<Complaint[]>([]);

  const [wards, setWards] = useState<Ward[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Officer Form State
  const [showAddOfficerModal, setShowAddOfficerModal] = useState(false);
  const [newOfficer, setNewOfficer] = useState({
    name: '',
    email: '',
    assignedWardId: '',
    agencyId: '',
    isActive: true,
  });

  // Action Modals State
  const [actionComplaint, setActionComplaint] = useState<Complaint | null>(null);
  const [actionType, setActionType] = useState<'assign' | 'resolveDispute' | 'rejectDispute' | 'invalidate' | null>(null);
  const [actionRemarks, setActionRemarks] = useState('');
  const [assignWardId, setAssignWardId] = useState('');
  const [assignAgencyId, setAssignAgencyId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Officer Deactivate Confirm State
  const [deactivatingOfficer, setDeactivatingOfficer] = useState<Officer | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [metaRes, officersRes, triageRes, disputesRes, complaintsRes] = await Promise.all([
        fetch('/api/admin/metadata'),
        fetch('/api/admin/officers'),
        fetch('/api/admin/triage'),
        fetch('/api/admin/disputes'),
        fetch('/api/complaints?limit=100'),
      ]);

      if (metaRes.ok) {
        const meta = await metaRes.json();
        setWards(meta.wards || []);
        setAgencies(meta.agencies || []);
      }
      if (officersRes.ok) {
        const data = await officersRes.json();
        setOfficers(data.officers || []);
      }
      if (triageRes.ok) {
        const data = await triageRes.json();
        setTriageComplaints(data.triageComplaints || []);
      }
      if (disputesRes.ok) {
        const data = await disputesRes.json();
        setDisputedComplaints(data.disputedComplaints || []);
      }
      if (complaintsRes.ok) {
        const data = await complaintsRes.json();
        setAllComplaints(data.complaints || []);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load administrative data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchAdminData();
    }
  }, [authStatus]);

  if (authStatus === 'loading') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-2 border-asphalt border-t-marking-yellow rounded-full animate-spin" />
        <p className="text-xs font-heading font-semibold text-asphalt-muted">Verifying administrative credentials...</p>
      </div>
    );
  }

  if (authStatus === 'unauthenticated' || session?.user?.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto my-16 p-6 bg-white rounded-control border border-border shadow-sheet text-center space-y-4">
        <div className="w-12 h-12 rounded-control bg-alert-red/10 text-alert-red flex items-center justify-center mx-auto border border-alert-red/20">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-heading font-black text-asphalt">Admin Authorization Required</h2>
        <p className="text-xs font-sans text-asphalt-muted leading-relaxed">
          Access to municipal officer allow-lists, unrouted triage queues, and dispute arbitration is strictly restricted to authorized administrators.
        </p>
        <Link href="/login?callbackUrl=/admin" className="block w-full">
          <Button variant="primary" className="w-full">
            Sign In with Admin Account
          </Button>
        </Link>
      </div>
    );
  }

  // Handle Add Officer
  const handleAddOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/officers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOfficer),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add officer');

      setMessage({ text: `Officer ${newOfficer.name} added successfully`, type: 'success' });
      setShowAddOfficerModal(false);
      setNewOfficer({ name: '', email: '', assignedWardId: '', agencyId: '', isActive: true });
      fetchAdminData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Toggle Officer Active
  const handleConfirmToggleOfficer = async () => {
    if (!deactivatingOfficer) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/officers/${deactivatingOfficer._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !deactivatingOfficer.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update officer status');

      setMessage({ text: `Officer status updated successfully`, type: 'success' });
      setDeactivatingOfficer(null);
      fetchAdminData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Manual Routing / Assignment
  const handleAssignComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionComplaint) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/complaints/${actionComplaint._id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wardId: assignWardId,
          agencyId: assignAgencyId,
          remarks: actionRemarks || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign complaint');

      setMessage({ text: `Complaint assigned to ward and agency successfully`, type: 'success' });
      setActionComplaint(null);
      setActionType(null);
      setActionRemarks('');
      setAssignWardId('');
      setAssignAgencyId('');
      fetchAdminData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Dispute Arbitration
  const handleArbitrateDispute = async (action: 'resolve' | 'reject') => {
    if (!actionComplaint) return;
    if (!actionRemarks || actionRemarks.trim().length < 5) {
      setMessage({ text: 'Arbitration remarks (at least 5 characters) are strictly required', type: 'error' });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/complaints/${actionComplaint._id}/arbitrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          remarks: actionRemarks,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dispute arbitration failed');

      setMessage({ text: `Dispute arbitrated as ${action.toUpperCase()} successfully`, type: 'success' });
      setActionComplaint(null);
      setActionType(null);
      setActionRemarks('');
      fetchAdminData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Complaint Invalidation
  const handleInvalidateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionComplaint) return;
    if (!actionRemarks || actionRemarks.trim().length < 5) {
      setMessage({ text: 'A detailed reason (at least 5 characters) is required to invalidate a complaint', type: 'error' });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/complaints/${actionComplaint._id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: actionRemarks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to invalidate complaint');

      setMessage({ text: `Complaint marked as Rejected - Invalid`, type: 'success' });
      setActionComplaint(null);
      setActionType(null);
      setActionRemarks('');
      fetchAdminData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-kerb min-h-[calc(100vh-64px)] pb-20 md:pb-12">
      {/* Top Header Plate */}
      <div className="bg-white border-b border-border py-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-plate bg-asphalt text-marking-yellow text-[11px] font-heading font-bold">
                Control Center
              </span>
              <span className="text-xs text-asphalt-muted font-sans">
                {session.user.email} (Administrator)
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-asphalt tracking-tight">
              Municipal Admin Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={fetchAdminData} disabled={loading} title="Refresh Data">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {activeTab === 'officers' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowAddOfficerModal(true)}
                className="flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add Officer</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Toast / Message Banner */}
        {message && (
          <div
            className={`p-3 rounded-plate text-xs font-sans border flex items-center justify-between ${
              message.type === 'success'
                ? 'bg-fixed-green/10 border-fixed-green/30 text-fixed-green'
                : 'bg-alert-red/10 border-alert-red/30 text-alert-red'
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{message.text}</span>
            </div>
            <button onClick={() => setMessage(null)} className="text-asphalt-muted hover:text-asphalt">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Navigation Plates */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
          {[
            { id: 'officers', label: 'Officer Allow-List', count: officers.length },
            { id: 'triage', label: 'Triage Queue (Unrouted)', count: triageComplaints.length, alert: triageComplaints.length > 0 },
            { id: 'disputes', label: 'Disputed Review', count: disputedComplaints.length, alert: disputedComplaints.length > 0 },
            { id: 'invalid', label: 'Invalidate Reports', count: allComplaints.length },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-plate text-xs font-heading font-semibold transition flex items-center gap-2 ${
                  active
                    ? 'bg-asphalt text-marking-yellow shadow-sm'
                    : 'bg-white text-asphalt-muted border border-border hover:bg-kerb'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    tab.alert
                      ? 'bg-alert-red text-white'
                      : active
                      ? 'bg-marking-yellow text-asphalt'
                      : 'bg-kerb text-asphalt-muted'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Officer Allow-List Table */}
        {activeTab === 'officers' && (
          <div className="bg-white border border-border rounded-control overflow-hidden">
            <div className="px-4 py-3 bg-kerb/50 border-b border-border flex items-center justify-between text-xs font-heading font-bold text-asphalt">
              <span>Authorized Field Officers</span>
              <span className="text-[11px] font-normal text-asphalt-muted">
                {officers.length} registered
              </span>
            </div>

            {officers.length === 0 ? (
              <EmptyState title="No officers registered" description="Add officers to the allow-list to grant field resolution privileges." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead className="bg-kerb/30 border-b border-border text-[11px] font-heading font-bold uppercase tracking-wider text-asphalt-muted">
                    <tr>
                      <th className="px-4 py-2.5">Officer Name</th>
                      <th className="px-4 py-2.5">Email (@demo.jaago.app)</th>
                      <th className="px-4 py-2.5">Assigned Ward</th>
                      <th className="px-4 py-2.5">Agency</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {officers.map((off) => (
                      <tr key={off._id} className="hover:bg-kerb/20">
                        <td className="px-4 py-3 font-heading font-bold text-asphalt">{off.name}</td>
                        <td className="px-4 py-3 font-mono text-asphalt-muted">{off.email}</td>
                        <td className="px-4 py-3">
                          {off.assignedWardId ? (
                            <span className="px-2 py-0.5 rounded-plate bg-kerb border border-border text-[11px] font-heading font-semibold">
                              {off.assignedWardId.name} ({off.assignedWardId.code})
                            </span>
                          ) : (
                            <span className="text-alert-red font-semibold text-[11px]">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-asphalt">
                          {off.agencyId?.shortName || off.agencyId?.name || 'Unassigned'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-plate text-[10px] font-heading font-bold ${
                              off.isActive
                                ? 'bg-fixed-green/10 text-fixed-green border border-fixed-green/30'
                                : 'bg-asphalt-muted/10 text-asphalt-muted border border-border'
                            }`}
                          >
                            {off.isActive ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setDeactivatingOfficer(off)}
                            className="text-[11px]"
                          >
                            {off.isActive ? 'Deactivate' : 'Reactivate'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Triage Queue (Unrouted Complaints) */}
        {activeTab === 'triage' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-control border border-border flex items-center justify-between">
              <div>
                <h2 className="font-heading font-bold text-sm text-asphalt">Unrouted Complaints Triage</h2>
                <p className="text-xs text-asphalt-muted font-sans">
                  Tickets that fell outside automated GeoJSON ward boundaries. Require manual routing before dispatch.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-plate bg-marking-yellow text-asphalt text-xs font-heading font-bold">
                {triageComplaints.length} tickets
              </span>
            </div>

            {triageComplaints.length === 0 ? (
              <EmptyState title="Triage queue is clear" description="All complaints have been successfully mapped to wards and agencies." />
            ) : (
              <div className="bg-white border border-border rounded-control divide-y divide-border overflow-hidden">
                {triageComplaints.map((c) => (
                  <div key={c._id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-plate bg-alert-red/10 text-alert-red border border-alert-red/30 text-[11px] font-heading font-bold">
                          Unrouted
                        </span>
                        <span className="text-xs text-asphalt-muted font-heading font-semibold">
                          {c.category}
                        </span>
                      </div>
                      <h3 className="font-heading font-bold text-sm text-asphalt">{c.title}</h3>
                      <p className="text-xs text-asphalt-muted font-sans line-clamp-1">{c.address || 'Address unlisted'}</p>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setActionComplaint(c);
                        setActionType('assign');
                      }}
                      className="shrink-0"
                    >
                      Assign Ward &amp; Agency
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Disputed - Admin Review Queue */}
        {activeTab === 'disputes' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-control border border-border flex items-center justify-between">
              <div>
                <h2 className="font-heading font-bold text-sm text-asphalt">Disputed - Admin Review Queue</h2>
                <p className="text-xs text-asphalt-muted font-sans">
                  Tickets locked to admin arbitration after multiple citizen contests.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-plate bg-signboard-blue text-white text-xs font-heading font-bold">
                {disputedComplaints.length} disputed
              </span>
            </div>

            {disputedComplaints.length === 0 ? (
              <EmptyState title="No active disputes" description="All resolutions have been confirmed by citizens or cleanly closed." />
            ) : (
              <div className="space-y-4">
                {disputedComplaints.map((c) => (
                  <div key={c._id} className="p-5 bg-white border border-border rounded-control space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border">
                      <div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={c.status} />
                          <span className="text-xs text-alert-red font-heading font-bold">
                            {c.reopenCount || 3} Contests Logged
                          </span>
                        </div>
                        <h3 className="font-heading font-bold text-base text-asphalt mt-1">{c.title}</h3>
                      </div>
                      <div className="text-xs text-asphalt-muted font-sans">
                        Ward: <strong>{c.wardId?.name}</strong> • Agency: <strong>{c.agencyId?.shortName}</strong>
                      </div>
                    </div>

                    <p className="text-xs font-sans text-asphalt leading-relaxed">{c.description}</p>

                    {/* Proof Photographs Comparison */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-kerb p-3 rounded-control border border-border">
                      <div>
                        <span className="text-[11px] font-heading font-bold text-asphalt-muted block mb-1.5">
                          Original Issue Photo
                        </span>
                        {c.imageUrl ? (
                          <div className="relative aspect-video rounded-control overflow-hidden border border-border bg-white">
                            <Image src={c.imageUrl} alt="Original" fill sizes="400px" className="object-cover" unoptimized />
                          </div>
                        ) : (
                          <div className="aspect-video bg-white rounded-control flex items-center justify-center text-xs text-asphalt-muted">
                            No photo
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="text-[11px] font-heading font-bold text-asphalt-muted block mb-1.5">
                          Officer Resolution Photo
                        </span>
                        {c.resolutionImageUrl ? (
                          <div className="relative aspect-video rounded-control overflow-hidden border border-border bg-white">
                            <Image src={c.resolutionImageUrl} alt="Resolution" fill sizes="400px" className="object-cover" unoptimized />
                          </div>
                        ) : (
                          <div className="aspect-video bg-white rounded-control flex items-center justify-center text-xs text-asphalt-muted">
                            No photo
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Arbitration Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <Link href={`/complaints/${c._id}`} className="text-xs font-heading font-semibold text-signboard-blue hover:underline">
                        View Full Audit Trail &rarr;
                      </Link>

                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setActionComplaint(c);
                            setActionType('resolveDispute');
                          }}
                        >
                          Resolve Dispute (Accept Fix)
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setActionComplaint(c);
                            setActionType('rejectDispute');
                          }}
                        >
                          Reject Fix (Reopen Issue)
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Invalidate Reports */}
        {activeTab === 'invalid' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-control border border-border flex items-center justify-between">
              <div>
                <h2 className="font-heading font-bold text-sm text-asphalt">Administrative Invalidation</h2>
                <p className="text-xs text-asphalt-muted font-sans">
                  Mark false, duplicate, or out-of-jurisdiction complaints as Rejected - Invalid.
                </p>
              </div>
            </div>

            <div className="bg-white border border-border rounded-control divide-y divide-border overflow-hidden">
              {allComplaints.slice(0, 25).map((c) => (
                <div key={c._id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={c.status} />
                      <span className="text-xs text-asphalt-muted">{c.category}</span>
                    </div>
                    <h3 className="font-heading font-bold text-sm text-asphalt">{c.title}</h3>
                    <p className="text-xs text-asphalt-muted font-sans line-clamp-1">{c.address || c.wardId?.name}</p>
                  </div>

                  {c.status !== 'Rejected - Invalid' && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setActionComplaint(c);
                        setActionType('invalidate');
                      }}
                      className="shrink-0"
                    >
                      Mark Invalid
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog: Deactivate / Reactivate Officer */}
      {deactivatingOfficer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-asphalt/50 backdrop-blur-sm">
          <div className="bg-white rounded-control border border-border shadow-sheet p-6 max-w-sm w-full space-y-4">
            <h3 className="font-heading font-bold text-base text-asphalt">
              {deactivatingOfficer.isActive ? 'Deactivate Field Officer' : 'Reactivate Field Officer'}
            </h3>
            <p className="text-xs font-sans text-asphalt-muted leading-relaxed">
              Are you sure you want to {deactivatingOfficer.isActive ? 'deactivate' : 'reactivate'}{' '}
              <strong className="text-asphalt font-semibold">{deactivatingOfficer.name}</strong>?
              {deactivatingOfficer.isActive && ' They will lose field resolution access immediately.'}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button variant="secondary" size="sm" onClick={() => setDeactivatingOfficer(null)}>
                Cancel
              </Button>
              <Button
                variant={deactivatingOfficer.isActive ? 'destructive' : 'primary'}
                size="sm"
                onClick={handleConfirmToggleOfficer}
                disabled={submitting}
              >
                {submitting ? 'Updating...' : deactivatingOfficer.isActive ? 'Confirm Deactivation' : 'Confirm Activation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Triage Assignment */}
      {actionComplaint && actionType === 'assign' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-asphalt/50 backdrop-blur-sm">
          <div className="bg-white rounded-control border border-border shadow-sheet p-6 max-w-md w-full space-y-4">
            <h3 className="font-heading font-bold text-base text-asphalt">
              Manual Ward &amp; Agency Routing
            </h3>
            <p className="text-xs text-asphalt-muted">{actionComplaint.title}</p>

            <form onSubmit={handleAssignComplaint} className="space-y-3">
              <div>
                <label className="block text-xs font-heading font-bold text-asphalt mb-1">
                  Assign to Ward
                </label>
                <select
                  required
                  value={assignWardId}
                  onChange={(e) => setAssignWardId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-heading font-semibold rounded-plate border border-border bg-white text-asphalt"
                >
                  <option value="">Select Ward</option>
                  {wards.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-asphalt mb-1">
                  Assign to Agency
                </label>
                <select
                  required
                  value={assignAgencyId}
                  onChange={(e) => setAssignAgencyId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-heading font-semibold rounded-plate border border-border bg-white text-asphalt"
                >
                  <option value="">Select Agency</option>
                  {agencies.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.shortName} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-asphalt mb-1">
                  Routing Remarks
                </label>
                <textarea
                  value={actionRemarks}
                  onChange={(e) => setActionRemarks(e.target.value)}
                  rows={2}
                  placeholder="Reason for manual boundary routing..."
                  className="w-full px-3 py-2 text-xs font-sans rounded-control border border-border bg-white text-asphalt"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="secondary" size="sm" onClick={() => setActionComplaint(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submitting || !assignWardId || !assignAgencyId}>
                  {submitting ? 'Routing...' : 'Confirm Assignment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Dispute Arbitration */}
      {actionComplaint && (actionType === 'resolveDispute' || actionType === 'rejectDispute') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-asphalt/50 backdrop-blur-sm">
          <div className="bg-white rounded-control border border-border shadow-sheet p-6 max-w-md w-full space-y-4">
            <h3 className="font-heading font-bold text-base text-asphalt">
              {actionType === 'resolveDispute' ? 'Arbitrate Dispute: Accept Resolution' : 'Arbitrate Dispute: Reject & Reopen'}
            </h3>
            <p className="text-xs text-asphalt-muted leading-relaxed">
              {actionType === 'resolveDispute'
                ? 'Confirming this resolution will mark the complaint as Resolved - Citizen Verified through administrative executive authority.'
                : 'Rejecting this resolution will return the complaint to the field officer for rework.'}
            </p>

            <div>
              <label className="block text-xs font-heading font-bold text-asphalt mb-1">
                Mandatory Arbitration Findings
              </label>
              <textarea
                required
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                rows={3}
                placeholder="State documented justification (contractor logs, CCTV, on-site inspection)..."
                className="w-full px-3 py-2 text-xs font-sans rounded-control border border-border bg-white text-asphalt"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="secondary" size="sm" onClick={() => setActionComplaint(null)}>
                Cancel
              </Button>
              <Button
                variant={actionType === 'resolveDispute' ? 'primary' : 'destructive'}
                size="sm"
                onClick={() => handleArbitrateDispute(actionType === 'resolveDispute' ? 'resolve' : 'reject')}
                disabled={submitting || !actionRemarks.trim()}
              >
                {submitting ? 'Arbitrating...' : 'Confirm Ruling'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Invalidate Complaint */}
      {actionComplaint && actionType === 'invalidate' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-asphalt/50 backdrop-blur-sm">
          <div className="bg-white rounded-control border border-border shadow-sheet p-6 max-w-md w-full space-y-4">
            <h3 className="font-heading font-bold text-base text-asphalt">
              Mark Complaint Rejected - Invalid
            </h3>
            <p className="text-xs text-asphalt-muted leading-relaxed">
              This action terminates the redressal workflow for &quot;{actionComplaint.title}&quot;. A clear public reason must be recorded in the audit trail.
            </p>

            <div>
              <label className="block text-xs font-heading font-bold text-asphalt mb-1">
                Invalidation Reason
              </label>
              <textarea
                required
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                rows={3}
                placeholder="State why this report is invalid (e.g., private property, duplicate, malicious)..."
                className="w-full px-3 py-2 text-xs font-sans rounded-control border border-border bg-white text-asphalt"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="secondary" size="sm" onClick={() => setActionComplaint(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleInvalidateComplaint}
                disabled={submitting || !actionRemarks.trim()}
              >
                {submitting ? 'Invalidating...' : 'Confirm Invalidation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Officer */}
      {showAddOfficerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-asphalt/50 backdrop-blur-sm">
          <div className="bg-white rounded-control border border-border shadow-sheet p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-heading font-bold text-base text-asphalt">Authorize New Field Officer</h3>
              <button onClick={() => setShowAddOfficerModal(false)} className="text-asphalt-muted hover:text-asphalt">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddOfficer} className="space-y-3">
              <div>
                <label className="block text-xs font-heading font-bold text-asphalt mb-1">Full Name</label>
                <input
                  required
                  type="text"
                  value={newOfficer.name}
                  onChange={(e) => setNewOfficer({ ...newOfficer, name: e.target.value })}
                  placeholder="e.g. Ramesh Gowda (AEE)"
                  className="w-full px-3 py-2 text-xs font-sans rounded-plate border border-border bg-white text-asphalt"
                />
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-asphalt mb-1">
                  Email Address (@demo.jaago.app)
                </label>
                <input
                  required
                  type="email"
                  value={newOfficer.email}
                  onChange={(e) => setNewOfficer({ ...newOfficer, email: e.target.value })}
                  placeholder="officer.ward@demo.jaago.app"
                  className="w-full px-3 py-2 text-xs font-sans rounded-plate border border-border bg-white text-asphalt"
                />
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-asphalt mb-1">Assigned Ward</label>
                <select
                  required
                  value={newOfficer.assignedWardId}
                  onChange={(e) => setNewOfficer({ ...newOfficer, assignedWardId: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-heading font-semibold rounded-plate border border-border bg-white text-asphalt"
                >
                  <option value="">Select Ward</option>
                  {wards.map((w) => (
                    <option key={w._id} value={w._id}>
                      {w.name} ({w.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-heading font-bold text-asphalt mb-1">Assigned Agency</label>
                <select
                  required
                  value={newOfficer.agencyId}
                  onChange={(e) => setNewOfficer({ ...newOfficer, agencyId: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-heading font-semibold rounded-plate border border-border bg-white text-asphalt"
                >
                  <option value="">Select Agency</option>
                  {agencies.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.shortName} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddOfficerModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                  {submitting ? 'Authorizing...' : 'Authorize Officer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
