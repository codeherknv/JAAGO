'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  MapPin,
  Camera,
  AlertCircle,
  ThumbsUp,
  CheckCircle,
  Loader2,
  Navigation,
  UploadCloud,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

const CATEGORIES = [
  'Roads',
  'Sanitation',
  'Streetlights',
  'Water Supply & Drainage',
  'Others',
];

// Pilot Quick-Coordinates for desktop/demo testing
const PILOT_LOCATIONS = [
  { name: 'Bellandur (Outer Ring Rd)', lat: 12.9304, lng: 77.6784, address: 'Outer Ring Rd, Bellandur, Bengaluru' },
  { name: 'HSR Layout (27th Main)', lat: 12.9115, lng: 77.6442, address: '27th Main Rd, Sector 1, HSR Layout, Bengaluru' },
  { name: 'Koramangala (80 Feet Rd)', lat: 12.9345, lng: 77.6255, address: '80 Feet Rd, 4th Block, Koramangala, Bengaluru' },
];

export default function ReportComplaintPage() {
  const router = useRouter();

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Status & loaders
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Deduplication Modal
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [upvotingExisting, setUpvotingExisting] = useState(false);
  const [upvoteSuccessMessage, setUpvoteSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger GPS location capture
  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setLocation({
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy),
        });
        setLocating(false);
      },
      (err) => {
        console.warn('GPS Error, falling back to pilot default:', err);
        setLocationError(`GPS signal unavailable (${err.message}). Choose a pilot Bengaluru coordinate below for testing.`);
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Photo change handler
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit. Please upload an image under 5MB.');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger 40m nearby check as soon as location and category are chosen
  useEffect(() => {
    if (!location || !category) return;

    const checkDuplicates = async () => {
      setCheckingDuplicates(true);
      try {
        const res = await fetch(
          `/api/complaints/nearby?lat=${location.lat}&lng=${location.lng}&category=${encodeURIComponent(
            category
          )}&maxDistance=40`
        );
        const data = await res.json();

        if (data.complaints && data.complaints.length > 0) {
          setDuplicateMatches(data.complaints);
          setShowDuplicateModal(true);
        } else {
          setDuplicateMatches([]);
          setShowDuplicateModal(false);
        }
      } catch (err) {
        console.error('Failed to check nearby complaints:', err);
      } finally {
        setCheckingDuplicates(false);
      }
    };

    checkDuplicates();
  }, [location, category]);

  // Handle Upvoting existing duplicate instead of creating a new ticket
  const handleUpvoteExisting = async (existingComplaintId: string) => {
    setUpvotingExisting(true);
    try {
      const res = await fetch(`/api/complaints/${existingComplaintId}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (res.ok || res.status === 409) {
        setUpvoteSuccessMessage(
          res.status === 409
            ? 'You have already upvoted this complaint. Following updates!'
            : 'Upvote recorded! Your voice has boosted this ticket priority.'
        );
        setTimeout(() => {
          router.push(`/complaints/${existingComplaintId}`);
        }, 1200);
      } else {
        alert(data.error || 'Failed to upvote existing issue');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    } finally {
      setUpvotingExisting(false);
    }
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!location) {
      setSubmitError('Please capture your current location or select a pilot location.');
      return;
    }
    if (!category) {
      setSubmitError('Please select a civic category.');
      return;
    }
    if (!imagePreview) {
      setSubmitError('A photographic proof is required to submit a complaint.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload image to local endpoint (or signed Cloudinary)
      let uploadedUrl = imagePreview;
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);

        const uploadRes = await fetch('/api/uploads/local', {
          method: 'POST',
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          uploadedUrl = uploadData.url;
        }
      }

      // 2. Submit complaint
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category,
          lat: location.lat,
          lng: location.lng,
          address: address || 'Near captured coordinates',
          imageUrl: uploadedUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit complaint');
      }

      router.push(`/complaints/${data.complaint._id}`);
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:px-6">
      <div className="mb-8">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-bold uppercase mb-2">
          <span>Bengaluru Pilot</span>
          <span>&bull;</span>
          <span>W-150 / W-174 / W-151</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          File Geo-Tagged Civic Complaint
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Capture photographic evidence and GPS coordinates. High-accuracy deduplication ensures your issue is tracked without spam.
        </p>
      </div>

      {submitError && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
          <div>
            <p className="font-bold">Submission Failed</p>
            <p className="text-xs mt-0.5">{submitError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm">
        {/* Step 1: Location & Accuracy */}
        <div className="space-y-3 pb-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-orange-600" />
              <span>1. Incident Geolocation (Native GPS)</span>
            </label>
            {location && (
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  location.accuracy <= 20
                    ? 'bg-emerald-100 text-emerald-800'
                    : location.accuracy <= 50
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                Accuracy: ±{location.accuracy}m
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleCaptureGPS}
              disabled={locating}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-sm font-bold transition disabled:opacity-50"
            >
              {locating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Locking GPS Coordinates...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 text-orange-400" />
                  <span>{location ? 'Re-acquire Device GPS' : 'Capture Current GPS'}</span>
                </>
              )}
            </button>
          </div>

          {location && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <p className="font-semibold text-slate-700">
                Lat: <span className="text-slate-900">{location.lat.toFixed(6)}</span> | Lng:{' '}
                <span className="text-slate-900">{location.lng.toFixed(6)}</span>
              </p>
              <p className="text-slate-500">Auto-routes to Bengaluru pilot wards via $geoIntersects.</p>
            </div>
          )}

          {locationError && (
            <p className="text-xs text-red-600 font-medium">{locationError}</p>
          )}

          {/* Quick-test selectors for evaluation */}
          <div className="pt-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Or pick representative Bengaluru pilot coordinate:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PILOT_LOCATIONS.map((loc) => (
                <button
                  key={loc.name}
                  type="button"
                  onClick={() => {
                    setLocation({ lat: loc.lat, lng: loc.lng, accuracy: 8 });
                    setAddress(loc.address);
                    setLocationError(null);
                  }}
                  className={`text-left p-2.5 rounded-lg border text-xs font-medium transition ${
                    location?.lat === loc.lat && location?.lng === loc.lng
                      ? 'border-orange-500 bg-orange-50 text-orange-900 font-bold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <p className="truncate">{loc.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">±8m accuracy</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step 2: Civic Category */}
        <div className="space-y-3 pb-6 border-b border-slate-100">
          <label className="text-sm font-bold text-slate-900 flex items-center justify-between">
            <span>2. Civic Problem Category</span>
            {checkingDuplicates && (
              <span className="text-xs text-orange-600 flex items-center space-x-1 font-medium">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking 40m radius deduplication...</span>
              </span>
            )}
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`p-3 rounded-xl border text-sm font-semibold transition text-left ${
                  category === cat
                    ? 'border-orange-600 bg-orange-600 text-white shadow-sm shadow-orange-600/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Step 3: Photo Proof (capture="environment") */}
        <div className="space-y-3 pb-6 border-b border-slate-100">
          <label className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Camera className="w-4 h-4 text-orange-600" />
            <span>3. Camera Evidence (capture=&quot;environment&quot;)</span>
          </label>
          <p className="text-xs text-slate-500">
            Field photo required. Live camera capture is enforced on mobile devices to prevent stale submissions.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoCapture}
            className="hidden"
          />

          {imagePreview ? (
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video max-h-64 flex items-center justify-center">
              <img
                src={imagePreview}
                alt="Complaint Preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-black/75 hover:bg-black text-white text-xs font-semibold backdrop-blur-sm transition"
              >
                Retake Photo
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-orange-500 hover:bg-orange-50/20 rounded-2xl p-8 text-center cursor-pointer transition"
            >
              <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-3">
                <Camera className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                Tap to Open Camera / Upload Evidence
              </p>
              <p className="text-xs text-slate-500 mt-1">
                JPEG, PNG, WebP up to 5MB
              </p>
            </div>
          )}
        </div>

        {/* Step 4: Issue Details */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-900">Issue Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Broken water drain slab causing road block"
              className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900">Address / Landmark</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Opposite BDA Complex, 27th Main, Sector 1"
              className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Provide specific details about the severity, road hazards, or waterlogging..."
              className="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-base shadow-lg shadow-orange-600/25 transition disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Verifying Spatial Bounds & Ingesting...</span>
              </>
            ) : (
              <span>Submit Civic Complaint</span>
            )}
          </button>
        </div>
      </form>

      {/* Duplicate Detected Interception Modal */}
      {showDuplicateModal && duplicateMatches.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-amber-500 p-6 text-white">
              <div className="flex items-center space-x-2.5">
                <ShieldAlert className="w-6 h-6 text-white" />
                <h3 className="text-xl font-black">Duplicate Issue Detected Nearby!</h3>
              </div>
              <p className="text-xs text-amber-100 mt-1">
                40-Meter Proximity Check: An active complaint with matching category &apos;{category}&apos; already exists at this spot.
              </p>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {duplicateMatches.map((match) => (
                <div
                  key={match._id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="flex gap-3">
                    <img
                      src={match.imageUrl}
                      alt={match.title}
                      className="w-20 h-20 rounded-xl object-cover shrink-0 border border-slate-200 bg-slate-100"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          {match.distanceMeters}m away
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          {match.status}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 mt-1 line-clamp-1">
                        {match.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                        {match.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-xs font-bold text-slate-700">
                      👍 {match.upvotesCount} Citizens Upvoted
                    </span>

                    <button
                      type="button"
                      disabled={upvotingExisting}
                      onClick={() => handleUpvoteExisting(match._id)}
                      className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-600/20 transition flex items-center space-x-1.5"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>Upvote & Follow This Issue</span>
                    </button>
                  </div>
                </div>
              ))}

              {upvoteSuccessMessage && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>{upvoteSuccessMessage}</span>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg hover:bg-slate-200/60 transition"
              >
                No, this is a distinct issue. Continue filing.
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
