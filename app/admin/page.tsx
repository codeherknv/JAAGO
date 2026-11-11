'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
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
  ArrowRight,
  MapPin,
  Building2,
  Calendar,
  Lock,
} from 'lucide-react';

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
        const metaData = await metaRes.json();
        setWards(metaData.wards || []);
        setAgencies(metaData.agencies || []);
      }

      if (officersRes.ok) {
        const data = await officersRes.json();
        setOfficers(data.officers || []);
      }

      if (triageRes.ok) {
        const data = await triageRes.json();
        setTriageComplaints(data.complaints || []);
      }

      if (disputesRes.ok) {
        const data = await disputesRes.json();
        setDisputedComplaints(data.complaints || []);
      }

      if (complaintsRes.ok) {
        const data = await complaintsRes.json();
        setAllComplaints(data.complaints || []);
      }
    } catch (err: any) {
      setMessage({ text: 'Failed to load admin data: ' + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user && (session.user as any).role === 'admin') {
      fetchAdminData();
    }
  }, [session]);

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

      setMessage({ text: 'Officer added to allow-list successfully!', type: 'success' });
      setShowAddOfficerModal(false);
      setNewOfficer({ name: '', email: '', assignedWardId: '', agencyId: '', isActive: true });
      fetchAdminData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleOfficerStatus = async (officerId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/officers/${officerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');

      setMessage({
        text: `Officer status changed to ${!currentStatus ? 'Active' : 'Inactive'}`,
        type: 'success',
      });
      fetchAdminData();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  const handleExecuteAction = async () => {
    if (!actionComplaint || !actionType) return;
    setSubmitting(true);
    setMessage(null);

    try {
      if (actionType === 'assign') {
        const res = await fetch(`/api/admin/complaints/${actionComplaint._id}/assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wardId: assignWardId || undefined,
            agencyId: assignAgencyId || undefined,
            remarks: actionRemarks || 'Assigned by municipal administrator.',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Assignment failed');
        setMessage({ text: 'Complaint assigned and routed successfully', type: 'success' });
      } else if (actionType === 'resolveDispute' || actionType === 'rejectDispute') {
        const action = actionType === 'resolveDispute' ? 'resolve' : 'reject';
        const res = await fetch(`/api/admin/complaints/${actionComplaint._id}/arbitrate`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            remarks: actionRemarks,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Dispute arbitration failed');
        setMessage({
          text: `Dispute arbitrated: ${action === 'resolve' ? 'Marked Resolved' : 'Marked Invalid'}`,
          type: 'success',
        });
      } else if (actionType === 'invalidate') {
        const res = await fetch(`/api/admin/complaints/${actionComplaint._id}/reject`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: actionRemarks }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invalidation failed');
        setMessage({ text: 'Complaint marked as Rejected - Invalid', type: 'success' });
      }

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

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const userRole = (session?.user as any)?.role;
  if (!session?.user || userRole !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Administrator Access Required</h1>
          <p className="text-slate-600 mb-6">
            You must be signed in with an administrative account to access the Jaago Command Center.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
          >
            Sign in as Administrator
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-white">JAAGO</span>
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                ADMIN CONTROL CENTER
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">
              Greater Bengaluru Authority • Pilot Governance & Oversight
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchAdminData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg border border-slate-700 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-slate-300 hover:text-white text-sm"
            >
              Explore Map
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* Alerts */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center justify-between text-sm ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            <span>{message.text}</span>
            <button
              onClick={() => setMessage(null)}
              className="text-slate-400 hover:text-slate-600 font-bold ml-4"
            >
              ×
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 mb-6">
          <button
            onClick={() => setActiveTab('officers')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'officers'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Officer Allow-List
            <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-indigo-900/30 text-indigo-100">
              {officers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('triage')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'triage'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <GitPullRequest className="w-4 h-4" />
            Triage Queue
            {triageComplaints.length > 0 && (
              <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-amber-500 text-white font-bold">
                {triageComplaints.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('disputes')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'disputes'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Disputed - Admin Review
            {disputedComplaints.length > 0 && (
              <span className="ml-1.5 px-2 py-0.5 text-xs rounded-full bg-purple-600 text-white font-bold">
                {disputedComplaints.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('invalid')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'invalid'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <XCircle className="w-4 h-4" />
            Invalidate Complaints
          </button>
        </div>

        {/* Tab 1: Officer Allow-List */}
        {activeTab === 'officers' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Municipal Officer Allow-List</h2>
                <p className="text-sm text-slate-500">
                  Pre-authorized municipal officers with jurisdiction routing and resolution privileges.
                </p>
              </div>
              <button
                onClick={() => setShowAddOfficerModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                Add Officer
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3.5">Officer Name</th>
                    <th className="px-6 py-3.5">Email Address</th>
                    <th className="px-6 py-3.5">Assigned Ward</th>
                    <th className="px-6 py-3.5">Agency</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {officers.map((officer) => (
                    <tr key={officer._id} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-4 font-medium text-slate-900">{officer.name}</td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-xs">{officer.email}</td>
                      <td className="px-6 py-4 text-slate-700">
                        {officer.assignedWardId ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                            <MapPin className="w-3 h-3" />
                            {officer.assignedWardId.name} ({officer.assignedWardId.code})
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        {officer.agencyId ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-xs font-medium">
                            <Building2 className="w-3 h-3" />
                            {officer.agencyId.shortName}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            officer.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {officer.isActive ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleToggleOfficerStatus(officer._id, officer.isActive)}
                          className={`px-3 py-1 rounded text-xs font-semibold transition ${
                            officer.isActive
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {officer.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {officers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        No officers configured in allow-list. Click &quot;Add Officer&quot; to configure municipal staff.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Triage Queue */}
        {activeTab === 'triage' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Unrouted & Triage Queue</h2>
                <p className="text-sm text-slate-500">
                  Complaints filed without a matching ward polygon or agency that require manual assignment.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                {triageComplaints.length} tickets pending triage
              </span>
            </div>

            {triageComplaints.map((c) => (
              <div key={c._id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-5 items-start justify-between">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700">
                      {c.category}
                    </span>
                    <span className="text-xs text-slate-400">ID: {c._id}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{c.title}</h3>
                  <p className="text-sm text-slate-600 line-clamp-2">{c.description}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {c.address || 'Address not specified'}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <button
                    onClick={() => {
                      setActionComplaint(c);
                      setActionType('assign');
                      setAssignWardId(c.wardId?._id || '');
                      setAssignAgencyId(c.agencyId?._id || '');
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
                  >
                    Assign Ward & Agency
                  </button>
                  <button
                    onClick={() => {
                      setActionComplaint(c);
                      setActionType('invalidate');
                    }}
                    className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 text-sm font-medium rounded-lg border border-rose-200 transition"
                  >
                    Reject as Invalid
                  </button>
                </div>
              </div>
            ))}

            {triageComplaints.length === 0 && (
              <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-slate-800">Triage queue is completely clear!</p>
                <p className="text-sm text-slate-500 mt-1">
                  All complaints have been cleanly routed to wards and agencies via GeoJSON polygons.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Disputed - Admin Review Queue */}
        {activeTab === 'disputes' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Disputed - Admin Review Queue</h2>
                <p className="text-sm text-slate-500">
                  Circuit breaker tripped after 3 consecutive citizen contests. Requires final municipal arbitration.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
                {disputedComplaints.length} disputed tickets
              </span>
            </div>

            {disputedComplaints.map((c) => (
              <div key={c._id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-800 uppercase tracking-wider">
                      Circuit Breaker Tripped ({c.reopenCount || 3} Disputes)
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">{c.title}</h3>
                  </div>
                  <div className="text-xs text-slate-500">
                    Ward: <strong>{c.wardId?.name || 'Unassigned'}</strong> • Agency: <strong>{c.agencyId?.shortName || 'Unassigned'}</strong>
                  </div>
                </div>

                <p className="text-sm text-slate-700">{c.description}</p>

                {/* Before / After Photo Comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                      Original Incident Proof
                    </span>
                    {c.imageUrl ? (
                      <img
                        src={c.imageUrl}
                        alt="Original"
                        className="w-full h-48 object-cover rounded-md border border-slate-200"
                      />
                    ) : (
                      <div className="w-full h-48 bg-slate-200 rounded-md flex items-center justify-center text-xs text-slate-500">
                        No image
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                      Officer Resolution Proof
                    </span>
                    {c.resolutionImageUrl ? (
                      <img
                        src={c.resolutionImageUrl}
                        alt="Resolution"
                        className="w-full h-48 object-cover rounded-md border border-slate-200"
                      />
                    ) : (
                      <div className="w-full h-48 bg-slate-200 rounded-md flex items-center justify-center text-xs text-slate-500">
                        No resolution photo
                      </div>
                    )}
                  </div>
                </div>

                {/* Dispute History Summary */}
                <div className="bg-amber-50/60 p-3.5 rounded-lg border border-amber-200/80 text-xs text-amber-900 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Audit Remarks & Citizen Feedback:
                  </span>
                  {c.statusHistory && c.statusHistory.length > 0 ? (
                    <p className="italic">&quot;{c.statusHistory[c.statusHistory.length - 1]?.remarks || 'No remarks logged'}&quot;</p>
                  ) : (
                    <p>No remarks available.</p>
                  )}
                </div>

                {/* Arbitration Actions */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => {
                      setActionComplaint(c);
                      setActionType('resolveDispute');
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Uphold Resolution (Mark Citizen Verified)
                  </button>
                  <button
                    onClick={() => {
                      setActionComplaint(c);
                      setActionType('rejectDispute');
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Resolution (Mark Invalid)
                  </button>
                </div>
              </div>
            ))}

            {disputedComplaints.length === 0 && (
              <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-500">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-slate-800">No active disputed complaints!</p>
                <p className="text-sm text-slate-500 mt-1">
                  Citizen disputes within 120 hours have either been verified or re-routed to field officers.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Invalidate Complaints */}
        {activeTab === 'invalid' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Complaint Invalidation Registry</h2>
              <p className="text-sm text-slate-500">
                Select any complaint to mark as &quot;Rejected - Invalid&quot; with required justification logged to the audit log.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Current Status</th>
                    <th className="px-4 py-3">Reporter</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {allComplaints.slice(0, 30).map((c) => (
                    <tr key={c._id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3 font-medium text-slate-900 max-w-xs truncate">{c.title}</td>
                      <td className="px-4 py-3 text-slate-600">{c.category}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            c.status === 'Rejected - Invalid'
                              ? 'bg-rose-100 text-rose-800'
                              : c.status.startsWith('Resolved')
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs">
                        {c.reportedBy?.name || c.reportedBy?.email || 'Citizen'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.status !== 'Rejected - Invalid' ? (
                          <button
                            onClick={() => {
                              setActionComplaint(c);
                              setActionType('invalidate');
                            }}
                            className="px-3 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-xs font-medium border border-rose-200 transition"
                          >
                            Mark Invalid
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Invalidated</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add Officer Modal */}
      {showAddOfficerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Add Officer to Municipal Allow-List</h3>
            <form onSubmit={handleAddOfficer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newOfficer.name}
                  onChange={(e) => setNewOfficer({ ...newOfficer, name: e.target.value })}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Official Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newOfficer.email}
                  onChange={(e) => setNewOfficer({ ...newOfficer, email: e.target.value })}
                  placeholder="officer.name@demo.jaago.app"
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Assigned Ward
                  </label>
                  <select
                    required
                    value={newOfficer.assignedWardId}
                    onChange={(e) => setNewOfficer({ ...newOfficer, assignedWardId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Ward...</option>
                    {wards.map((w) => (
                      <option key={w._id} value={w._id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Civic Agency
                  </label>
                  <select
                    required
                    value={newOfficer.agencyId}
                    onChange={(e) => setNewOfficer({ ...newOfficer, agencyId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Agency...</option>
                    {agencies.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.shortName} - {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveOfficer"
                  checked={newOfficer.isActive}
                  onChange={(e) => setNewOfficer({ ...newOfficer, isActive: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="isActiveOfficer" className="text-sm font-medium text-slate-700">
                  Activate officer immediately
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddOfficerModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Add Officer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Execution Modal (Assign, Arbitrate, Invalidate) */}
      {actionComplaint && actionType && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {actionType === 'assign' && 'Manual Triage & Agency Assignment'}
              {actionType === 'resolveDispute' && 'Uphold Dispute Resolution'}
              {actionType === 'rejectDispute' && 'Reject Dispute Resolution'}
              {actionType === 'invalidate' && 'Mark Complaint as Rejected - Invalid'}
            </h3>

            <p className="text-sm text-slate-600">
              Ticket: <strong className="text-slate-900">{actionComplaint.title}</strong>
            </p>

            {actionType === 'assign' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Select Ward
                  </label>
                  <select
                    value={assignWardId}
                    onChange={(e) => setAssignWardId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Ward...</option>
                    {wards.map((w) => (
                      <option key={w._id} value={w._id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Select Agency
                  </label>
                  <select
                    value={assignAgencyId}
                    onChange={(e) => setAssignAgencyId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">Select Agency...</option>
                    {agencies.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.shortName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                {actionType === 'invalidate' ? 'Reason for Invalidation (Required)' : 'Audit Remarks (Appended to Audit Trail)'}
              </label>
              <textarea
                required
                rows={3}
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                placeholder="Enter justification or remarks..."
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setActionComplaint(null);
                  setActionType(null);
                  setActionRemarks('');
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAction}
                disabled={submitting || (actionType === 'invalidate' && actionRemarks.trim().length < 5)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
              >
                {submitting ? 'Executing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
