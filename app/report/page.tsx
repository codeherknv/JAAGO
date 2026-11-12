'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Camera,
  MapPin,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Upload,
  RefreshCw,
  Info,
} from 'lucide-react';
import { uploadToCloudinary } from '@/lib/cloudinaryClient';
import { Button } from '@/components/ui/Button';
import { ComplaintRow } from '@/components/ui/ComplaintRow';
import { LocationMiniMap } from '@/components/LocationMiniMap';
import { useTranslation } from '@/lib/i18n';

const CATEGORIES = [
  'Roads',
  'Sanitation',
  'Streetlights',
  'Water Supply & Drainage',
  'Others',
];

const PILOT_LOCATIONS = [
  { name: 'HSR Layout (27th Main)', lat: 12.9115, lng: 77.6442, address: '27th Main Rd, Sector 1, HSR Layout, Bengaluru' },
  { name: 'Bellandur (Outer Ring Rd)', lat: 12.9304, lng: 77.6784, address: 'Outer Ring Rd, Bellandur, Bengaluru' },
  { name: 'Koramangala (80 Feet Rd)', lat: 12.9345, lng: 77.6255, address: '80 Feet Rd, 4th Block, Koramangala, Bengaluru' },
];

export default function ReportPage() {
  const router = useRouter();
  const { t } = useTranslation();

  // Multi-step progress: 1 = Photo, 2 = Location & Duplicates, 3 = Category & Note
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('Roads');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [confirmDistinct, setConfirmDistinct] = useState(false);

  // Status & loaders
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [upvotingId, setUpvotingId] = useState<string | null>(null);
  const [upvoteNotice, setUpvoteNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle GPS location capture
  const captureGPS = () => {
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
        setLocationError(`GPS signal unavailable (${err.message}). Choose a pilot Bengaluru coordinate below.`);
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Automatically start GPS when entering step 2 if not yet set
  useEffect(() => {
    if (step === 2 && !location) {
      captureGPS();
    }
  }, [step, location]);

  // Photo change handler
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setSubmitError('File exceeds the strict 5MB limit. Please upload an image under 5MB.');
        return;
      }
      setSubmitError(null);
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Inline duplicate checking when location or category changes in step 2
  useEffect(() => {
    if (!location) return;

    const checkDuplicates = async () => {
      setCheckingDuplicates(true);
      try {
        const res = await fetch(
          `/api/complaints/nearby?lat=${location.lat}&lng=${location.lng}&category=${encodeURIComponent(
            category
          )}&maxDistance=40`
        );
        const data = await res.json();
        if (data.complaints && Array.isArray(data.complaints)) {
          setDuplicateMatches(data.complaints);
        } else {
          setDuplicateMatches([]);
        }
      } catch (err) {
        console.error('Failed to check nearby complaints:', err);
      } finally {
        setCheckingDuplicates(false);
      }
    };

    checkDuplicates();
  }, [location, category]);

  // Support / Upvote an existing duplicate report inline
  const handleSupportDuplicate = async (existingId: string) => {
    setUpvotingId(existingId);
    setUpvoteNotice(null);
    try {
      const res = await fetch(`/api/complaints/${existingId}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (res.ok || res.status === 409) {
        setUpvoteNotice(
          res.status === 409
            ? 'You have already supported this report. Opening issue page.'
            : 'Support recorded. You helped prioritize this issue without creating a duplicate.'
        );
        setTimeout(() => {
          router.push(`/complaints/${existingId}`);
        }, 1200);
      } else {
        setSubmitError(data.error || 'Failed to support this report.');
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Network error.');
    } finally {
      setUpvotingId(null);
    }
  };

  // Final Form Submission
  const handleSubmit = async () => {
    setSubmitError(null);

    if (!imagePreview) {
      setSubmitError('A photo proof is required to submit a complaint.');
      setStep(1);
      return;
    }

    if (!location) {
      setSubmitError('Please confirm your location coordinates.');
      setStep(2);
      return;
    }

    if (!title.trim()) {
      setSubmitError('Please enter a brief title for the problem.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload photo to Cloudinary
      let uploadedUrl = imagePreview;
      if (imageFile) {
        uploadedUrl = await uploadToCloudinary(imageFile);
      }

      // 2. Submit complaint
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || 'Civic problem reported via Jaago.',
          category,
          lat: location.lat,
          lng: location.lng,
          address: address.trim() || 'Near captured coordinates',
          imageUrl: uploadedUrl,
          confirmDistinct,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        // Intercepted by server duplicate check
        if (data.duplicates && data.duplicates.length > 0) {
          setDuplicateMatches(data.duplicates);
          setStep(2); // Go back to location step to inspect inline duplicates
        }
        throw new Error(data.error || 'A similar complaint was reported within 40 m.');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit complaint.');
      }

      router.push(`/complaints/${data.complaint._id}`);
    } catch (err: any) {
      setSubmitError(err.message || 'Something went wrong while submitting.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 sm:py-10">
      {/* Three-step bottom sheet container */}
      <div className="bg-white rounded-control border border-border overflow-hidden shadow-sheet">
        {/* Header with Step Indicator */}
        <div className="px-5 py-3.5 border-b border-border bg-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-marking-yellow border border-asphalt" />
              <h1 className="text-base font-heading font-bold text-asphalt">
                {t.reportProblem}
              </h1>
            </div>
            <p className="text-xs text-asphalt-muted mt-0.5">
              Greater Bengaluru Authority pilot
            </p>
          </div>

          <span className="text-xs font-heading font-semibold text-asphalt px-2 py-0.5 bg-kerb rounded-plate border border-border">
            {t.stepOf(step, 3)}
          </span>
        </div>

        {/* Global Error Banner */}
        {submitError && (
          <div className="m-4 p-3 bg-alert-light border border-alert-red/30 rounded-control flex items-start gap-2.5 text-xs text-alert-red font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-heading font-bold">Action needed</p>
              <p className="mt-0.5">{submitError}</p>
            </div>
          </div>
        )}

        {/* Upvote Success Notice */}
        {upvoteNotice && (
          <div className="m-4 p-3 bg-fixed-light border border-fixed-green/30 rounded-control flex items-center gap-2 text-xs text-fixed-green font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{upvoteNotice}</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 1: PHOTO CAPTURE */}
        {/* ------------------------------------------------------------- */}
        {step === 1 && (
          <div className="p-5 space-y-5">
            <div>
              <h2 className="text-sm font-heading font-bold text-asphalt">
                Step 1: Capture photo of the problem
              </h2>
              <p className="text-xs text-asphalt-muted mt-0.5 leading-relaxed">
                Take a clear photo outdoors showing the issue and surrounding street landmarks.
              </p>
            </div>

            {/* Hidden native input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {!imagePreview ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-[4/3] rounded-control border-2 border-dashed border-border bg-kerb hover:bg-kerb-dark/50 cursor-pointer flex flex-col items-center justify-center p-6 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-signboard-blue"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    fileInputRef.current?.click();
                  }
                }}
              >
                <div className="w-14 h-14 rounded-full bg-marking-yellow border-2 border-asphalt flex items-center justify-center text-asphalt shadow-float mb-3">
                  <Camera className="w-7 h-7 stroke-[2]" />
                </div>
                <p className="text-sm font-heading font-bold text-asphalt">
                  {t.takeLivePhoto}
                </p>
                <p className="text-xs text-asphalt-muted mt-1 max-w-xs">
                  Tap to open camera or select an existing photo under 5MB.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative w-full aspect-[4/3] rounded-control overflow-hidden border border-border bg-asphalt">
                  <Image
                    src={imagePreview}
                    alt="Problem photo preview"
                    fill
                    sizes="(max-width: 768px) 100vw, 600px"
                    className="object-cover"
                    unoptimized={imagePreview.startsWith('data:')}
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-asphalt/80 text-white rounded-plate text-[11px] font-heading font-semibold border border-white/20">
                    Photo captured
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    {t.changePhoto}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 1 Actions */}
            <div className="pt-2 border-t border-border flex justify-end">
              <Button
                variant="primary"
                size="lg"
                disabled={!imagePreview}
                onClick={() => setStep(2)}
              >
                <span>{t.confirmLocation}</span>
                <ChevronRight className="w-4 h-4 ml-1 stroke-[2.5]" />
              </Button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 2: CONFIRM LOCATION & INLINE DUPLICATE RESOLUTION */}
        {/* ------------------------------------------------------------- */}
        {step === 2 && (
          <div className="p-5 space-y-5">
            <div>
              <h2 className="text-sm font-heading font-bold text-asphalt">
                Step 2: Confirm location &amp; check existing reports
              </h2>
              <p className="text-xs text-asphalt-muted mt-0.5 leading-relaxed">
                Confirm your GPS position. If someone already reported this nearby, support their ticket to speed up resolution.
              </p>
            </div>

            {/* GPS Status & Accuracy */}
            <div className="p-3 bg-white rounded-control border border-border space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-signboard-blue shrink-0" />
                  <span className="text-xs font-heading font-bold text-asphalt">
                    {location
                      ? t.accuracyMeters(location.accuracy)
                      : locating
                      ? 'Locating via GPS...'
                      : 'GPS location required'}
                  </span>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={captureGPS}
                  disabled={locating}
                >
                  {locating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  )}
                  <span>Refresh GPS</span>
                </Button>
              </div>

              {locationError && (
                <p className="text-xs text-alert-red font-medium">
                  {locationError}
                </p>
              )}

              {location && (
                <div className="space-y-2">
                  {/* Small Leaflet Map Preview */}
                  <LocationMiniMap
                    lat={location.lat}
                    lng={location.lng}
                    accuracy={location.accuracy}
                  />

                  {/* Street Address Input */}
                  <div>
                    <label className="block text-xs font-heading font-semibold text-asphalt mb-1">
                      Street address or landmark
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. 27th Main Road, near BDA Complex"
                      className="w-full px-3 py-2 text-xs rounded-control border border-border bg-kerb/30 text-asphalt focus:bg-white focus:border-signboard-blue"
                    />
                  </div>
                </div>
              )}

              {/* Pilot Quick-Select Coordinates for Demo/Testing */}
              <div className="pt-2 border-t border-border-subtle">
                <span className="text-[11px] font-heading font-semibold text-asphalt-muted block mb-1.5">
                  Or select a pilot Bengaluru test location:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PILOT_LOCATIONS.map((loc) => (
                    <button
                      key={loc.name}
                      type="button"
                      onClick={() => {
                        setLocation({ lat: loc.lat, lng: loc.lng, accuracy: 8 });
                        setAddress(loc.address);
                        setLocationError(null);
                      }}
                      className="px-2 py-1 text-[11px] font-heading font-medium rounded-plate bg-kerb hover:bg-kerb-dark border border-border text-asphalt transition-colors"
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* INLINE DUPLICATE MATCHES (NEVER A BLOCKING MODAL) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-heading font-bold text-asphalt flex items-center gap-1.5">
                  <span>{t.duplicateNotice}</span>
                  {checkingDuplicates && (
                    <Loader2 className="w-3 h-3 animate-spin text-asphalt-muted" />
                  )}
                </h3>
                <span className="text-[11px] text-asphalt-muted">
                  Within 40 m proximity
                </span>
              </div>

              {duplicateMatches.length > 0 ? (
                <div className="border border-attention-amber/50 rounded-control overflow-hidden bg-attention-light/40">
                  <div className="px-3.5 py-2 bg-attention-light border-b border-attention-amber/30 flex items-center gap-2 text-xs text-asphalt">
                    <Info className="w-4 h-4 text-attention-amber shrink-0" />
                    <span>
                      Found {duplicateMatches.length} existing report near you. Support it to prioritize without duplicating.
                    </span>
                  </div>

                  <div className="divide-y divide-border">
                    {duplicateMatches.map((dup) => (
                      <ComplaintRow
                        key={dup._id}
                        id={dup._id}
                        title={dup.title}
                        address={dup.address}
                        category={dup.category}
                        status={dup.status}
                        distanceMeters={dup.distanceMeters || 12}
                        imageUrl={dup.imageUrl}
                        upvotesCount={dup.upvotesCount || 1}
                        actionButton={
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={upvotingId === dup._id}
                            onClick={() => handleSupportDuplicate(dup._id)}
                          >
                            {upvotingId === dup._id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              t.supportReport
                            )}
                          </Button>
                        }
                      />
                    ))}
                  </div>

                  <div className="p-3 bg-white border-t border-border flex items-center justify-between">
                    <span className="text-xs text-asphalt-muted">
                      Is your problem separate?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDistinct(true);
                        setStep(3);
                      }}
                      className="text-xs font-heading font-bold text-signboard-blue hover:underline"
                    >
                      {t.differentProblem} &rarr;
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-kerb/50 rounded-control border border-border text-xs text-asphalt-muted flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-fixed-green shrink-0" />
                  <span>No duplicate reports found nearby. Proceed to add details.</span>
                </div>
              )}
            </div>

            {/* Step 2 Navigation Actions */}
            <div className="pt-2 border-t border-border flex justify-between items-center">
              <Button variant="ghost" size="md" onClick={() => setStep(1)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span>{t.back}</span>
              </Button>

              <Button
                variant="primary"
                size="lg"
                disabled={!location}
                onClick={() => setStep(3)}
              >
                <span>{t.next}: Details</span>
                <ChevronRight className="w-4 h-4 ml-1 stroke-[2.5]" />
              </Button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 3: CATEGORY & PROBLEM NOTE */}
        {/* ------------------------------------------------------------- */}
        {step === 3 && (
          <div className="p-5 space-y-5">
            <div>
              <h2 className="text-sm font-heading font-bold text-asphalt">
                Step 3: Select category and describe the problem
              </h2>
              <p className="text-xs text-asphalt-muted mt-0.5 leading-relaxed">
                Categorization routes your issue automatically to the responsible municipal agency.
              </p>
            </div>

            {/* Category Chips */}
            <div>
              <label className="block text-xs font-heading font-bold text-asphalt mb-2">
                Civic Category
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`min-h-[44px] px-3.5 py-2 rounded-control font-heading text-xs font-semibold border transition-colors ${
                        isSelected
                          ? 'bg-asphalt text-marking-yellow border-asphalt shadow-sm'
                          : 'bg-white hover:bg-kerb text-asphalt border-border'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Problem Title */}
            <div>
              <label className="block text-xs font-heading font-bold text-asphalt mb-1">
                Problem Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Open drain cover on 27th Main"
                maxLength={100}
                className="w-full px-3.5 py-2.5 text-sm rounded-control border border-border bg-white text-asphalt focus:border-signboard-blue focus:ring-1 focus:ring-signboard-blue"
              />
              <span className="text-[11px] text-asphalt-subtle mt-1 block">
                Be specific about the hazard and nearest landmark.
              </span>
            </div>

            {/* Note / Description */}
            <div>
              <label className="block text-xs font-heading font-bold text-asphalt mb-1">
                Description / Notes
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe size, depth, duration, or immediate pedestrian hazard..."
                maxLength={500}
                className="w-full px-3.5 py-2.5 text-xs rounded-control border border-border bg-white text-asphalt focus:border-signboard-blue focus:ring-1 focus:ring-signboard-blue resize-none"
              />
            </div>

            {/* Summary Review Plate */}
            <div className="p-3 bg-kerb rounded-control border border-border flex items-center gap-3">
              {imagePreview && (
                <div className="relative w-12 h-12 rounded-plate overflow-hidden border border-border shrink-0 bg-asphalt">
                  <Image
                    src={imagePreview}
                    alt="Preview"
                    fill
                    sizes="48px"
                    className="object-cover"
                    unoptimized={imagePreview.startsWith('data:')}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-heading font-bold text-asphalt truncate">
                  {category} &bull; {address || 'Location captured'}
                </p>
                <p className="text-[11px] text-asphalt-muted truncate mt-0.5">
                  GPS: &plusmn;{location?.accuracy || 0} m accuracy
                </p>
              </div>
            </div>

            {/* Step 3 Actions */}
            <div className="pt-2 border-t border-border flex justify-between items-center">
              <Button
                variant="ghost"
                size="md"
                disabled={submitting}
                onClick={() => setStep(2)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span>{t.back}</span>
              </Button>

              <Button
                variant="primary"
                size="lg"
                disabled={submitting || !title.trim()}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span>Submitting report...</span>
                  </>
                ) : (
                  <span>{t.submitReport}</span>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
