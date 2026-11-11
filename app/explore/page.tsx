'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Compass,
  Filter,
  Layers,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

// Dynamic import with SSR disabled to eliminate Leaflet window reference errors
const CivicLeafletMap = dynamic(() => import('@/components/CivicLeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[650px] rounded-3xl bg-slate-100 flex flex-col items-center justify-center border border-slate-200">
      <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-2" />
      <p className="text-sm font-semibold text-slate-600">Loading Bengaluru GIS Map Layers...</p>
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
  const [complaints, setComplaints] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedWardId, setSelectedWardId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/complaints?limit=150');
      const data = await res.json();
      // Ensure complaints with no wardId are excluded from the public explore map
      const validComplaints = (data.complaints || []).filter(
        (c: any) => c.wardId && (c.wardId._id || typeof c.wardId === 'string')
      );
      setComplaints(validComplaints);

      // Extract unique wards
      const map = new Map();
      validComplaints.forEach((c: any) => {
        if (c.wardId && c.wardId._id) map.set(c.wardId._id, c.wardId);
      });
      setWards(Array.from(map.values()));
    } catch (err) {
      console.error('Failed to load explore data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-bold uppercase mb-2">
            <Compass className="w-3.5 h-3.5" />
            <span>Greater Bengaluru Spatial Transparency</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Live Civic Redressal Map
          </h1>
          <p className="text-sm text-slate-500">
            Real-time geospatial distribution of citizen reports, active repairs, and verified resolutions.
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-sm transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Map Layers</span>
        </button>
      </div>

      {/* Filter Chips & Legend */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        {/* Category & Ward Filter Chips */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center space-x-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Category:</span>
            </span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedCategory === cat
                    ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/25'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Ward Filter:
            </span>
            <select
              value={selectedWardId}
              onChange={(e) => setSelectedWardId(e.target.value)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Bengaluru Pilot Wards</option>
              {wards.map((w: any) => (
                <option key={w._id} value={w._id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Legend */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs gap-3">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[11px]">
            Marker Status Color Code:
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-700 font-medium">Pending</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-slate-700 font-medium">In Progress</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-300 ring-offset-1" />
              <span className="text-slate-700 font-bold text-blue-900">
                Pending Verification (120h Audit)
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-slate-700 font-medium">Resolved (Audited)</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-slate-700 font-medium">Reopened / Disputed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map Display */}
      <CivicLeafletMap
        complaints={complaints}
        wards={wards}
        selectedCategory={selectedCategory}
        selectedWardId={selectedWardId}
      />
    </div>
  );
}
