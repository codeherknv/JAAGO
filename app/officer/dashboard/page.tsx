'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  ShieldCheck,
  AlertTriangle,
  Clock,
  ThumbsUp,
  MapPin,
  CheckCircle,
  Camera,
  PlayCircle,
  Filter,
  RefreshCw,
  Navigation,
  Loader2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { calculateAllowedResolutionRadius } from '@/lib/geo';
import { uploadToCloudinary } from '@/lib/cloudinaryClient';

export default function OfficerDashboardPage() {
  const { data: session } = useSession();

  const [complaints, setComplaints] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [selectedWardId, setSelectedWardId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Resolution Modal State
  const [resolvingComplaint, setResolvingComplaint] = useState<any | null>(null);
  const [officerGPS, setOfficerGPS] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [resolutionRemarks, setResolutionRemarks] = useState('');
  const [resolutionPreview, setResolutionPreview] = useState<string | null>(null);
  const [resolutionFile, setResolutionFile] = useState<File | null>(null);
  const [submittingResolution, setSubmittingResolution] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize selected ward from session or pilot
  useEffect(() => {
    if (session?.user?.assignedWardId) {
      setSelectedWardId(session.user.assignedWardId);
    }
  }, [session]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch complaints
      let url = '/api/complaints?limit=100';
      if (selectedWardId) {
        url += `&wardId=${selectedWardId}`;
      }
      if (selectedCategory !== 'all') {
        url += `&category=${encodeURIComponent(selectedCategory)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      setComplaints(data.complaints || []);

      // 2. Extract unique wards for filter
      const allComplaintsRes = await fetch('/api/complaints?limit=100');
      const allData = await allComplaintsRes.json();
      const wardMap = new Map();
      (allData.complaints || []).forEach((c: any) => {
        if (c.wardId) {
          wardMap.set(c.wardId._id, c.wardId);
        }
      });
      setWards(Array.from(wardMap.values()));
    } catch (err) {
      console.error('Failed to load officer data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedWardId, selectedCategory]);

  // Handle Status change: Pending -> In Progress
  const handleStartWork = async (complaintId: string) => {
    try {
      const res = await fetch(`/api/complaints/${complaintId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'In Progress',
          remarks: 'Field engineer assigned and repair materials dispatched.',
        }),
      });
      if (res.ok) {
        loadData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update status');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Capture Officer Field GPS
  const handleCaptureOfficerGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported by your browser');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOfficerGPS({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setGpsLoading(false);
      },
      (err) => {
        alert(`GPS acquisition failed: ${err.message}. You can use the "Simulate On-Site" button for desktop testing.`);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Simulate on-site coordinates for desktop testing
  const handleSimulateOnSite = () => {
    if (!resolvingComplaint) return;
    const [cLng, cLat] = resolvingComplaint.location.coordinates;
    // Add minor 8m jitter
    const jitterLat = cLat + 0.00007;
    const jitterLng = cLng + 0.00007;
    setOfficerGPS({
      lat: jitterLat,
      lng: jitterLng,
      accuracy: 6,
    });
  };

  // Handle Photo selection for resolution
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setResolutionFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setResolutionPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Resolution
  const handleSubmitResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    setResolutionError(null);

    if (!officerGPS) {
      setResolutionError('Officer GPS coordinates are strictly required to verify physical presence.');
      return;
    }
    if (!resolutionPreview) {
      setResolutionError('Live photographic proof of completed work is required.');
      return;
    }

    setSubmittingResolution(true);
    try {
      let finalImageUrl = resolutionPreview;
      if (resolutionFile) {
        finalImageUrl = await uploadToCloudinary(resolutionFile);
      }

      const res = await fetch(`/api/complaints/${resolvingComplaint._id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: officerGPS.lat,
          lng: officerGPS.lng,
          accuracy: officerGPS.accuracy,
          resolutionImageUrl: finalImageUrl,
          remarks: resolutionRemarks || 'Field work executed and inspected.',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Resolution verification rejected');
      }

      setResolvingComplaint(null);
      setResolutionPreview(null);
      setOfficerGPS(null);
      setResolutionRemarks('');
      loadData();
    } catch (err: any) {
      setResolutionError(err.message || 'Verification rejected');
    } finally {
      setSubmittingResolution(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Municipal Field Command & Dispatch</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight">Officer Resolution Dashboard</h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Prioritized by Civic Urgency Score. Resolutions require verified live camera proof and GPS lock within allowed radius.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/15">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Logged In As</span>
              <span className="text-xs font-bold text-white">
                {session?.user?.name || 'Ramesh Gowda (AEE)'}
              </span>
              <span className="block text-[11px] text-emerald-400 font-semibold">
                Role: {session?.user?.role || 'officer'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Ward Filter & Status Chips */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5" />
            <span>Ward View:</span>
          </span>

          <select
            value={selectedWardId}
            onChange={(e) => setSelectedWardId(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">All Pilot Wards</option>
            {wards.map((w: any) => (
              <option key={w._id} value={w._id}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Categories</option>
            <option value="Roads">Roads</option>
            <option value="Sanitation">Sanitation</option>
            <option value="Water Supply & Drainage">Water Supply & Drainage</option>
            <option value="Streetlights">Streetlights</option>
            <option value="Others">Others</option>
          </select>
        </div>

        <button
          onClick={loadData}
          className="inline-flex items-center space-x-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-xl transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Complaints Queue Table / Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-slate-900">
            Active Civic Queue ({complaints.length} tickets) &bull; Ordered by Dynamic Priority Score
          </h2>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Priority = (Weight &times; 2) + (Upvotes &times; 1.5) + (Hours / 24) + (Reopens &times; 5)
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">Sorting complaints by priority...</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-2">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-base font-bold text-slate-800">No open tickets in this selection</p>
            <p className="text-xs text-slate-500">All registered issues in this ward have been resolved.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {complaints.map((c) => {
              const isOpen = ['Pending', 'In Progress', 'Reopened - Escalated'].includes(c.status);
              return (
                <div
                  key={c._id}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row gap-5 items-start md:items-center justify-between"
                >
                  <div className="flex gap-4 items-start flex-1 min-w-0">
                    <img
                      src={c.imageUrl}
                      alt={c.title}
                      className="w-24 h-24 rounded-xl object-cover shrink-0 border border-slate-200 bg-slate-100"
                    />
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-slate-900 text-white shadow-xs">
                          Score: {c.priorityScore?.toFixed(1) || '0.0'}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md ${
                            c.status === 'Pending'
                              ? 'bg-red-100 text-red-800'
                              : c.status === 'In Progress'
                              ? 'bg-amber-100 text-amber-800'
                              : c.status === 'Pending Verification'
                              ? 'bg-blue-100 text-blue-800'
                              : c.status === 'Reopened - Escalated'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {c.status}
                        </span>
                        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {c.category}
                        </span>
                        {c.reopenCount > 0 && (
                          <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            Disputes: {c.reopenCount}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-1">
                        {c.title}
                      </h3>

                      <p className="text-xs text-slate-500 flex items-center space-x-1 truncate">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{c.address}</span>
                        <span>&bull;</span>
                        <span className="font-semibold text-slate-700">
                          {c.wardId?.name} ({c.wardId?.code})
                        </span>
                      </p>

                      <div className="flex items-center space-x-3 text-xs text-slate-500 pt-1">
                        <span className="font-bold text-orange-600 flex items-center space-x-1">
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>{c.upvotesCount} upvotes</span>
                        </span>
                        <span>&bull;</span>
                        <span>Reported {new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full md:w-auto shrink-0 justify-end pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <Link
                      href={`/complaints/${c._id}`}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition flex items-center space-x-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </Link>

                    {c.status === 'Pending' && (
                      <button
                        onClick={() => handleStartWork(c._id)}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm shadow-amber-600/20 transition flex items-center space-x-1.5"
                      >
                        <PlayCircle className="w-4 h-4" />
                        <span>Start Work</span>
                      </button>
                    )}

                    {isOpen && (
                      <button
                        onClick={() => {
                          setResolvingComplaint(c);
                          setResolutionError(null);
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/25 transition flex items-center space-x-1.5"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Mark Resolved (GPS Lock)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resolution Modal with GPS Verification Enforced */}
      {resolvingComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="border-b border-slate-100 pb-4">
              <div className="inline-flex items-center space-x-1 text-xs font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full uppercase mb-2">
                <span>Invariant 4</span>
                <span>&bull;</span>
                <span>Location-Verified Resolution</span>
              </div>
              <h3 className="text-xl font-black text-slate-900">
                Verify & Resolve Field Ticket
              </h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                Target: {resolvingComplaint.title} ({resolvingComplaint.wardId?.name})
              </p>
            </div>

            {resolutionError && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <p className="font-bold">Resolution Rejected by Spatial Gatekeeper</p>
                  <p className="mt-1 leading-relaxed">{resolutionError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitResolution} className="space-y-5">
              {/* Step 1: Officer GPS Acquisition */}
              <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Navigation className="w-3.5 h-3.5 text-blue-600" />
                    <span>Officer Geolocation (Live Device GPS)</span>
                  </label>
                  {officerGPS && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      Accuracy: ±{officerGPS.accuracy}m | Allowed: &le;{' '}
                      {calculateAllowedResolutionRadius(officerGPS.accuracy)}m
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCaptureOfficerGPS}
                    disabled={gpsLoading}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center space-x-1.5"
                  >
                    {gpsLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Navigation className="w-3.5 h-3.5" />
                    )}
                    <span>{officerGPS ? 'Re-lock Current GPS' : 'Lock Device GPS'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSimulateOnSite}
                    className="py-2 px-3 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-bold transition"
                    title="Simulate on-site officer location within 10m of complaint coordinates for desktop testing"
                  >
                    Simulate On-Site (Desktop Test)
                  </button>
                </div>

                {officerGPS && (
                  <p className="text-[11px] text-slate-600">
                    Locked at Lat: {officerGPS.lat.toFixed(6)}, Lng: {officerGPS.lng.toFixed(6)}
                  </p>
                )}
              </div>

              {/* Step 2: Resolution Photo with capture="environment" */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                  <Camera className="w-3.5 h-3.5 text-orange-600" />
                  <span>Resolution Photographic Proof (capture=&quot;environment&quot;)</span>
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoCapture}
                  className="hidden"
                />

                {resolutionPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video max-h-48 flex items-center justify-center">
                    <img
                      src={resolutionPreview}
                      alt="Resolution Proof"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-2 right-2 px-3 py-1 bg-black/80 text-white text-[10px] font-bold rounded-lg"
                    >
                      Change Photo
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50 hover:bg-emerald-50/20 transition"
                  >
                    <Camera className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                    <p className="text-xs font-bold text-slate-800">
                      Take Live Resolution Photograph
                    </p>
                    <p className="text-[10px] text-slate-400">Mobile camera capture enforced</p>
                  </div>
                )}
              </div>

              {/* Step 3: Remarks */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">Field Remarks / Material Used</label>
                <textarea
                  value={resolutionRemarks}
                  onChange={(e) => setResolutionRemarks(e.target.value)}
                  rows={2}
                  placeholder="e.g. Asphalting completed with cold-mix bitumen, roller compacted and open for traffic."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResolvingComplaint(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResolution}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/25 transition disabled:opacity-50 flex items-center space-x-2"
                >
                  {submittingResolution ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Checking GPS Distance Gate...</span>
                    </>
                  ) : (
                    <span>Submit & Begin 120h Citizen Audit</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
