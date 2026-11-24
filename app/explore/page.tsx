'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Plus, RefreshCw, Filter, Layers, X, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ComplaintRow } from '@/components/ui/ComplaintRow';
import { StatusBadge } from '@/components/ui/StatusBadge';

// Dynamic import of Leaflet map with SSR disabled
const CivicLeafletMap = dynamic(() => import('@/components/CivicLeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-kerb flex flex-col items-center justify-center text-asphalt-muted">
      <div className="w-8 h-8 border-2 border-asphalt border-t-marking-yellow rounded-full animate-spin mb-3" />
      <span className="font-heading font-semibold text-xs tracking-wide">
        Loading road and ward boundaries...
      </span>
    </div>
  ),
});

const CATEGORIES = [
  'all',
  'Roads',
  'Sanitation',
  'Streetlights',
  'Water Supply & Drainage',
  'Others',
];

export default function ExplorePage() {
  const { t } = useTranslation();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedWardId, setSelectedWardId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState<any | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [zoomTopOffset, setZoomTopOffset] = useState<number>(72);

  useEffect(() => {
    const updateZoomOffset = () => {
      if (!filterBarRef.current || !pageRef.current) return;
      const containerRect = pageRef.current.getBoundingClientRect();
      const filterRect = filterBarRef.current.getBoundingClientRect();
      const bottomRelative = Math.ceil(filterRect.bottom - containerRect.top);
      if (bottomRelative > 0) {
        setZoomTopOffset(bottomRelative + 2);
      }
    };

    updateZoomOffset();
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateZoomOffset) : null;
    if (observer && filterBarRef.current) {
      observer.observe(filterBarRef.current);
    }
    window.addEventListener('resize', updateZoomOffset);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateZoomOffset);
    };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [res, wardsRes] = await Promise.all([
        fetch('/api/complaints?limit=150'),
        fetch('/api/wards'),
      ]);
      const data = await res.json();
      const wardsData = wardsRes.ok ? await wardsRes.json().catch(() => ({})) : {};

      // Ensure complaints with no wardId are excluded from the public explore map
      const validComplaints = (data.complaints || []).filter(
        (c: any) => c.wardId && (c.wardId._id || typeof c.wardId === 'string')
      );
      setComplaints(validComplaints);

      if (Array.isArray(wardsData.wards) && wardsData.wards.length > 0) {
        setWards(wardsData.wards);
      } else {
        // Fallback: extract unique wards from complaints
        const map = new Map();
        validComplaints.forEach((c: any) => {
          if (c.wardId && c.wardId._id) map.set(c.wardId._id, c.wardId);
        });
        setWards(Array.from(map.values()));
      }
    } catch (err) {
      console.error('Failed to load explore data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getCategoryLabel = (cat: string) => {
    if (cat === 'all') return t.allCategories;
    if (cat === 'Roads') return t.roads;
    if (cat === 'Sanitation') return t.sanitation;
    if (cat === 'Streetlights') return t.streetlights;
    if (cat === 'Water Supply & Drainage') return t.waterSupplyDrainage;
    return t.others;
  };

  return (
    <div ref={pageRef} className="relative w-full h-[calc(100vh-64px)] pb-16 md:pb-0 overflow-hidden bg-kerb">
      {/* Full-Screen GIS Leaflet Map */}
      <div
        className="absolute inset-0 w-full h-full explore-map-host"
        style={{ '--explore-zoom-top': `${zoomTopOffset}px` } as React.CSSProperties}
      >
        <CivicLeafletMap
          complaints={complaints}
          wards={wards}
          selectedCategory={selectedCategory}
          selectedWardId={selectedWardId}
          onSelectComplaint={(c) => setSelectedComplaint(c)}
          selectedComplaintId={selectedComplaint?._id}
        />
      </div>

      {/* Floating Top Controls Bar */}
      <div className="absolute top-3 inset-x-3 md:top-4 md:inset-x-6 z-[1000] pointer-events-none">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Category & Ward Filter Bar */}
          <div
            ref={filterBarRef}
            className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-sm rounded-control border border-border shadow-sheet pointer-events-auto overflow-x-auto max-w-full"
          >
            {/* Category Chips */}
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-plate text-xs font-heading font-semibold transition-colors shrink-0 ${
                    active
                      ? 'bg-asphalt text-marking-yellow'
                      : 'bg-kerb text-asphalt-muted hover:bg-border-subtle hover:text-asphalt'
                  }`}
                >
                  {getCategoryLabel(cat)}
                </button>
              );
            })}

            {/* Ward Selector */}
            <div className="h-4 w-px bg-border mx-1 hidden sm:block shrink-0" />
            <select
              value={selectedWardId}
              onChange={(e) => setSelectedWardId(e.target.value)}
              className="px-2 py-1 bg-kerb text-asphalt text-xs font-heading font-semibold rounded-plate border border-border-subtle focus:outline-none focus:ring-1 focus:ring-signboard-blue shrink-0 cursor-pointer"
            >
              <option value="">{t.allWards}</option>
              {wards.map((w: any) => (
                <option key={w._id} value={w._id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>

            {/* Refresh Button */}
            <button
              onClick={fetchData}
              disabled={loading}
              title="Refresh Map"
              className="p-1 rounded-plate text-asphalt-muted hover:text-asphalt hover:bg-kerb transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Yellow Primary Action Button: Report a Problem */}
          <div className="pointer-events-auto shrink-0 self-end sm:self-auto">
            <Link href="/report">
              <Button variant="primary" size="sm" className="shadow-sheet flex items-center gap-1.5">
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>{t.reportProblem}</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Floating Bottom Left Legend Trigger / Tray */}
      <div className="absolute bottom-20 md:bottom-6 left-3 md:left-6 z-[1000]">
        {!showLegend ? (
          <button
            onClick={() => setShowLegend(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/95 rounded-plate border border-border shadow-sheet text-xs font-heading font-semibold text-asphalt hover:bg-kerb"
          >
            <Layers className="w-3.5 h-3.5 text-signboard-blue" />
            <span>Map Legend</span>
          </button>
        ) : (
          <div className="p-3 bg-white/95 backdrop-blur-sm rounded-control border border-border shadow-sheet max-w-xs space-y-2 text-xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-border">
              <span className="font-heading font-bold text-asphalt">Marker Status Code</span>
              <button
                onClick={() => setShowLegend(false)}
                className="text-asphalt-muted hover:text-asphalt"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-sans">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-alert-red border border-white shrink-0" />
                <span className="text-asphalt">Pending</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-plate bg-marking-yellow border border-asphalt shrink-0" />
                <span className="text-asphalt">In Progress</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-plate rotate-45 bg-signboard-blue border border-white shrink-0" />
                <span className="text-asphalt">Pending Audit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-plate bg-fixed-green border border-white shrink-0" />
                <span className="text-asphalt">Resolved</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2 pt-1 border-t border-border-subtle">
                <span className="w-3 h-3 rounded-plate bg-[#7C3AED] border border-white shadow-[0_0_0_1px_#7C3AED] shrink-0" />
                <span className="text-asphalt font-semibold">Reopened / Disputed</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tapped Marker Bottom Sheet with ComplaintRow */}
      <BottomSheet
        isOpen={Boolean(selectedComplaint)}
        onClose={() => setSelectedComplaint(null)}
        title={selectedComplaint?.category || 'Issue summary'}
      >
        {selectedComplaint && (
          <div className="space-y-4">
            <ComplaintRow
              id={selectedComplaint._id}
              title={selectedComplaint.title}
              category={selectedComplaint.category}
              address={selectedComplaint.address || selectedComplaint.wardId?.name}
              status={selectedComplaint.status}
              upvotesCount={selectedComplaint.upvotesCount || 0}
              imageUrl={selectedComplaint.resolutionImageUrl || selectedComplaint.imageUrl}
            />

            <div className="pt-2 flex items-center justify-between border-t border-border">
              <div className="text-xs text-asphalt-muted">
                {selectedComplaint.wardId?.name} ({selectedComplaint.wardId?.code})
              </div>

              <Link href={`/complaints/${selectedComplaint._id}`}>
                <Button variant="primary" size="sm" className="flex items-center gap-1">
                  <span>{t.viewDetails}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
