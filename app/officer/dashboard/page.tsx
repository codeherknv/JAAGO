'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import {
  Wrench,
  Camera,
  MapPin,
  RefreshCw,
  Navigation,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  X,
  Upload,
} from 'lucide-react';
import { calculateHaversineDistance, calculateAllowedResolutionRadius } from '@/lib/geo';
import { uploadToCloudinary } from '@/lib/cloudinaryClient';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState } from '@/components/ui/EmptyState';

// Dynamic import of Leaflet map
const CivicLeafletMap = dynamic(() => import('@/components/CivicLeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-kerb flex flex-col items-center justify-center text-asphalt-muted">
      <div className="w-8 h-8 border-2 border-asphalt border-t-marking-yellow rounded-full animate-spin mb-2" />
      <span className="font-heading font-semibold text-xs">Loading GIS map...</span>
    </div>
  ),
});

export default function OfficerDashboardPage() {
  const { data: session } = useSession();
  const { t } = useTranslation();

  const [complaints, setComplaints] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [selectedWardId, setSelectedWardId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState<any | null>(null);

  // Resolution Sheet State
  const [resolvingComplaint, setResolvingComplaint] = useState<any | null>(null);
  const [officerGPS, setOfficerGPS] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [resolutionRemarks, setResolutionRemarks] = useState('');
  const [resolutionPreview, setResolutionPreview] = useState<string | null>(null);
  const [resolutionFile, setResolutionFile] = useState<File | null>(null);
  const [submittingResolution, setSubmittingResolution] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  // Camera stream state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize selected ward from session
  useEffect(() => {
    if (session?.user?.assignedWardId) {
      setSelectedWardId(session.user.assignedWardId);
    }
  }, [session]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/complaints?limit=100';
      if (selectedWardId) {
        url += `&wardId=${selectedWardId}`;
      }
      if (selectedCategory !== 'all') {
        url += `&category=${encodeURIComponent(selectedCategory)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      const validComplaints = (data.complaints || []).filter(
        (c: any) => c.wardId && (c.wardId._id || typeof c.wardId === 'string')
      );
      setComplaints(validComplaints);

      // Extract unique wards for filter
      const allComplaintsRes = await fetch('/api/complaints?limit=100');
      const allData = await allComplaintsRes.json();
      const wardMap = new Map();
      (allData.complaints || []).forEach((c: any) => {
        if (c.wardId && c.wardId._id) {
          wardMap.set(c.wardId._id, c.wardId);
        }
      });
      setWards(Array.from(wardMap.values()));
    } catch (err) {
      console.error('Failed to load officer data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedWardId, selectedCategory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Status change: Pending -> In Progress
  const handleStartWork = async (complaintId: string) => {
    try {
      const res = await fetch(`/api/complaints/${complaintId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'In Progress',
          remarks: 'Field engineer assigned and work initiated on site.',
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

  // Clean up media tracks on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      setCameraError(
        'Camera permission was denied or unavailable. Please use the button below to upload a photo from your device.'
      );
      setIsCameraActive(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Capture Photo from Camera Stream
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUri = canvas.toDataURL('image/jpeg', 0.85);
      setResolutionPreview(dataUri);
      stopCamera();
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
    const jitterLat = cLat + 0.00007; // ~8m away
    const jitterLng = cLng + 0.00007;
    setOfficerGPS({
      lat: jitterLat,
      lng: jitterLng,
      accuracy: 6,
    });
  };

  // Handle Photo selection from desktop file input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setResolutionError('Photographic proof of completed work is required.');
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
          remarks: resolutionRemarks || 'Field work executed and inspected on site.',
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
      stopCamera();
      loadData();
    } catch (err: any) {
      setResolutionError(err.message || 'Verification rejected');
    } finally {
      setSubmittingResolution(false);
    }
  };

  // Distance calculation helper
  const getGpsDistanceReadout = () => {
    if (!officerGPS || !resolvingComplaint) return null;
    const [cLng, cLat] = resolvingComplaint.location.coordinates;
    const dist = Math.round(
      calculateHaversineDistance(officerGPS.lat, officerGPS.lng, cLat, cLng)
    );
    const maxAllowed = calculateAllowedResolutionRadius(officerGPS.accuracy);
    const isNearby = dist <= maxAllowed;

    return {
      dist,
      accuracy: officerGPS.accuracy,
      maxAllowed,
      isNearby,
    };
  };

  const gpsReadout = getGpsDistanceReadout();

  const getDaysOpen = (createdAt: string) => {
    const hours = Math.round((Date.now() - new Date(createdAt).getTime()) / (3600 * 1000));
    if (hours < 24) return `${hours}h open`;
    const days = Math.floor(hours / 24);
    return `${days}d open`;
  };

  const getPriorityExplanation = (c: any) => {
    const parts: string[] = [];
    const supporters = c.upvotesCount || 1;
    const reopens = c.reopenCount || 0;
    const hours = Math.round((Date.now() - new Date(c.createdAt).getTime()) / (3600 * 1000));
    const days = Math.floor(hours / 24);

    if (supporters > 1) {
      parts.push(`${supporters} supporters`);
    }
    if (days >= 1) {
      parts.push(`open ${days}d`);
    } else if (hours >= 1) {
      parts.push(`open ${hours}h`);
    }
    if (c.category) {
      parts.push(`${c.category} SLA`);
    }
    if (reopens > 0) {
      parts.push(`contested ${reopens}x`);
    }

    if (parts.length === 0) {
      return 'Standard priority';
    }

    return `High priority: ${parts.join(', ')}`;
  };

  return (
    <div className="w-full bg-kerb min-h-[calc(100vh-64px)] pb-20 md:pb-8">
      {/* Top Header Plate */}
      <div className="bg-white border-b border-border py-4 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-plate bg-signboard-blue text-white text-[11px] font-heading font-bold">
                Field Operations
              </span>
              <span className="text-xs text-asphalt-muted font-sans">
                {session?.user?.name || 'Field Officer'} ({session?.user?.assignedWardId ? 'Ward Assigned' : 'Unassigned'})
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-heading font-black text-asphalt">
              Officer Priority Queue
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-heading font-semibold bg-kerb border border-border rounded-plate text-asphalt"
            >
              <option value="all">All Categories</option>
              <option value="Roads">Roads</option>
              <option value="Sanitation">Sanitation</option>
              <option value="Streetlights">Streetlights</option>
              <option value="Water Supply & Drainage">Water & Drainage</option>
              <option value="Others">Others</option>
            </select>

            <Button variant="secondary" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Responsive Grid: Desktop Left List + Right Map; Mobile Stacked */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Priority List (7 Cols on LG) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between px-1 text-xs text-asphalt-muted font-heading font-semibold">
              <span>{complaints.length} tickets in queue</span>
              <span>Sorted by civic urgency</span>
            </div>

            {complaints.length === 0 ? (
              <EmptyState
                title="No complaints in queue"
                description="All reported civic issues in this jurisdiction have been resolved or routed."
              />
            ) : (
              <div className="bg-white border border-border rounded-control divide-y divide-border overflow-hidden">
                {complaints.map((c) => {
                  const isPending = c.status === 'Pending';
                  const isInProgress = c.status === 'In Progress';
                  const isResolvable = isPending || isInProgress;

                  return (
                    <div
                      key={c._id}
                      className={`p-4 transition hover:bg-kerb/40 ${
                        selectedComplaint?._id === c._id ? 'bg-marking-yellow/10' : ''
                      }`}
                      onClick={() => setSelectedComplaint(c)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={c.status} />
                            <span className="px-1.5 py-0.5 rounded-plate bg-kerb text-[11px] font-heading font-semibold text-asphalt border border-border">
                              {c.category}
                            </span>
                            <span
                              title={`Priority score: ${c.priorityScore ? c.priorityScore.toFixed(1) : '10.0'}`}
                              className="text-[11px] font-sans font-medium text-signboard-blue bg-signboard-blue/10 px-2 py-0.5 rounded-plate border border-signboard-blue/20 cursor-help"
                            >
                              {getPriorityExplanation(c)}
                            </span>
                            <span className="text-[11px] text-asphalt-muted">
                              {getDaysOpen(c.createdAt)}
                            </span>
                          </div>

                          <h3 className="font-heading font-bold text-sm text-asphalt pt-0.5">
                            {c.title}
                          </h3>
                          <p className="text-xs text-asphalt-muted line-clamp-1 font-sans">
                            {c.address || c.wardId?.name}
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="shrink-0 flex flex-col gap-1.5 items-end">
                          {isPending && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartWork(c._id);
                              }}
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              <span>Start Work</span>
                            </Button>
                          )}

                          {isInProgress && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setResolvingComplaint(c);
                                setOfficerGPS(null);
                                setResolutionPreview(null);
                              }}
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Resolve</span>
                            </Button>
                          )}

                          <Link
                            href={`/complaints/${c._id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] font-heading font-semibold text-signboard-blue hover:underline flex items-center gap-0.5"
                          >
                            <span>Details</span>
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: GIS Ward Map (5 Cols on LG, sticky desktop) */}
          <div className="lg:col-span-5 sticky top-20">
            <div className="bg-white border border-border rounded-control p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-heading font-bold text-asphalt">
                <span>Jurisdiction Map</span>
                <span className="text-[11px] font-normal text-asphalt-muted">
                  Tap marker to select ticket
                </span>
              </div>
              <div className="h-[420px] rounded-control overflow-hidden border border-border">
                <CivicLeafletMap
                  complaints={complaints}
                  wards={wards}
                  selectedCategory={selectedCategory}
                  selectedWardId={selectedWardId}
                  onSelectComplaint={(c) => setSelectedComplaint(c)}
                  selectedComplaintId={selectedComplaint?._id}
                  heightClass="h-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resolution Bottom Sheet Flow */}
      <BottomSheet
        isOpen={Boolean(resolvingComplaint)}
        onClose={() => {
          stopCamera();
          setResolvingComplaint(null);
        }}
        title="Field Resolution Verification"
      >
        {resolvingComplaint && (
          <form onSubmit={handleSubmitResolution} className="space-y-4">
            <div>
              <span className="text-xs font-heading font-semibold text-asphalt-muted">
                Resolving complaint:
              </span>
              <h4 className="font-heading font-bold text-sm text-asphalt">
                {resolvingComplaint.title}
              </h4>
              <p className="text-xs text-asphalt-muted">{resolvingComplaint.address}</p>
            </div>

            {/* GPS Physical Presence Readout */}
            <div className="p-3 bg-kerb rounded-control border border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-xs text-asphalt flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-signboard-blue" />
                  <span>On-site GPS Verification</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCaptureOfficerGPS}
                    disabled={gpsLoading}
                  >
                    <Navigation className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                    <span>Get GPS</span>
                  </Button>
                  <button
                    type="button"
                    onClick={handleSimulateOnSite}
                    className="text-[10px] text-signboard-blue hover:underline font-heading font-medium"
                  >
                    Simulate On-Site
                  </button>
                </div>
              </div>

              {gpsReadout ? (
                <div
                  className={`p-2 rounded-plate text-xs font-sans border ${
                    gpsReadout.isNearby
                      ? 'bg-fixed-green/10 border-fixed-green/30 text-fixed-green font-semibold'
                      : 'bg-alert-red/10 border-alert-red/30 text-alert-red font-semibold'
                  }`}
                >
                  <p>You&apos;re {gpsReadout.dist} m from the site (accuracy: &plusmn;{gpsReadout.accuracy} m)</p>
                  <p className="text-[11px] font-normal mt-0.5">
                    {gpsReadout.isNearby
                      ? 'Location verified on site. Allowed radius: 50 m.'
                      : `You must step within ${gpsReadout.maxAllowed} m of the problem to submit.`}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-asphalt-muted">
                  Lock your GPS position on site to verify presence before uploading resolution proof.
                </p>
              )}
            </div>

            {/* Live Camera Stream with Desktop File Fallback */}
            <div className="space-y-2">
              <label className="block text-xs font-heading font-bold text-asphalt">
                Resolution Photograph Proof
              </label>

              {resolutionPreview ? (
                <div className="relative aspect-video rounded-control overflow-hidden border border-border bg-kerb">
                  <Image
                    src={resolutionPreview}
                    alt="Resolution preview"
                    fill
                    sizes="400px"
                    className="object-cover"
                    unoptimized={resolutionPreview.startsWith('data:') || resolutionPreview.startsWith('blob:')}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setResolutionPreview(null);
                      setResolutionFile(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-asphalt/80 text-white rounded-full hover:bg-asphalt"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : isCameraActive ? (
                <div className="relative aspect-video bg-black rounded-control overflow-hidden">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 inset-x-0 flex justify-center gap-3">
                    <Button type="button" variant="primary" size="sm" onClick={capturePhoto}>
                      Capture Photo
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={stopCamera}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={startCamera}
                    className="flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Live Camera</span>
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Photo</span>
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              )}
              {cameraError && (
                <p className="text-xs text-alert-red">{cameraError}</p>
              )}
            </div>

            {/* Resolution Remarks */}
            <div>
              <label className="block text-xs font-heading font-bold text-asphalt mb-1">
                Resolution Remarks
              </label>
              <textarea
                value={resolutionRemarks}
                onChange={(e) => setResolutionRemarks(e.target.value)}
                rows={2}
                placeholder="Describe repairs executed on site..."
                className="w-full px-3 py-2 text-xs font-sans rounded-control border border-border bg-white text-asphalt focus:outline-none focus:ring-1 focus:ring-signboard-blue"
              />
            </div>

            {resolutionError && (
              <div className="p-2 rounded-plate bg-alert-red/10 border border-alert-red/30 text-xs text-alert-red flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{resolutionError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  stopCamera();
                  setResolvingComplaint(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={submittingResolution || !officerGPS || !resolutionPreview}
              >
                {submittingResolution ? 'Submitting...' : 'Confirm Resolution'}
              </Button>
            </div>
          </form>
        )}
      </BottomSheet>
    </div>
  );
}
