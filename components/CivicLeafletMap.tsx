'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import { ThumbsUp, MapPin, ExternalLink } from 'lucide-react';

interface CivicLeafletMapProps {
  complaints: any[];
  wards: any[];
  selectedCategory: string;
  selectedWardId: string;
}

// Function to generate color-coded HTML pin icons
function createStatusIcon(status: string) {
  let bgColor = '#ef4444'; // Red for Pending
  let pulseRing = '';

  if (status === 'In Progress') {
    bgColor = '#f59e0b'; // Amber
  } else if (status === 'Pending Verification') {
    bgColor = '#3b82f6'; // Blue
    pulseRing = '<div style="position:absolute; inset:-4px; border-radius:50%; border:2px solid #3b82f6; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.75;"></div>';
  } else if (status.startsWith('Resolved')) {
    bgColor = '#10b981'; // Green
  } else if (status.startsWith('Reopened') || status.startsWith('Disputed')) {
    bgColor = '#8b5cf6'; // Purple
  }

  const html = `
    <div style="position:relative; width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
      ${pulseRing}
      <div style="width:24px; height:24px; border-radius:50%; background-color:${bgColor}; border:2.5px solid white; box-shadow:0 4px 6px -1px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; color:white; font-size:12px; font-weight:bold;">
        •
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

export default function CivicLeafletMap({
  complaints,
  wards,
  selectedCategory,
  selectedWardId,
}: CivicLeafletMapProps) {
  // Center of Greater Bengaluru Pilot (around Bellandur / HSR Layout)
  const defaultCenter: [number, number] = [12.925, 77.655];
  const defaultZoom = 13;

  // Filter complaints (strictly exclude any tickets without wardId)
  const filteredComplaints = complaints.filter((c) => {
    if (!c.wardId) return false;
    const matchesCategory = selectedCategory === 'all' || c.category === selectedCategory;
    const matchesWard = !selectedWardId || c.wardId?._id === selectedWardId;
    return matchesCategory && matchesWard;
  });

  return (
    <div className="relative w-full h-[650px] rounded-3xl overflow-hidden border border-slate-200 shadow-inner">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Render Bengaluru Pilot Ward Boundaries */}
        {wards.map((ward) => {
          if (!ward.boundary?.coordinates) return null;
          // In GeoJSON, coordinates are [lng, lat]; Leaflet Polygon expects [lat, lng]
          const leafletPositions = ward.boundary.coordinates[0].map(
            (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
          );

          return (
            <Polygon
              key={ward._id}
              positions={leafletPositions}
              pathOptions={{
                color: '#ea580c',
                weight: 2,
                dashArray: '4, 4',
                fillColor: '#f97316',
                fillOpacity: selectedWardId === ward._id ? 0.2 : 0.08,
              }}
            >
              <Popup>
                <div className="p-2 space-y-1">
                  <p className="font-extrabold text-slate-900 text-sm">
                    {ward.name} ({ward.code})
                  </p>
                  <p className="text-xs text-slate-500">{ward.corporation}</p>
                </div>
              </Popup>
            </Polygon>
          );
        })}

        {/* Render Complaint Markers */}
        {filteredComplaints.map((c) => {
          if (!c.location?.coordinates) return null;
          const [lng, lat] = c.location.coordinates;
          const icon = createStatusIcon(c.status);

          return (
            <Marker key={c._id} position={[lat, lng]} icon={icon}>
              <Popup>
                <div className="max-w-[240px] space-y-2 p-1">
                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-100">
                    <img
                      src={c.imageUrl}
                      alt={c.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div>
                    <span
                      className={`inline-block text-[10px] uppercase font-extrabold px-2 py-0.5 rounded ${
                        c.status === 'Pending'
                          ? 'bg-red-100 text-red-800'
                          : c.status === 'In Progress'
                          ? 'bg-amber-100 text-amber-800'
                          : c.status === 'Pending Verification'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {c.status}
                    </span>
                    <h4 className="font-bold text-slate-900 text-xs mt-1 line-clamp-2">
                      {c.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      {c.wardId?.name} ({c.wardId?.code})
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <span className="font-bold text-orange-600 flex items-center space-x-1">
                      <ThumbsUp className="w-3 h-3" />
                      <span>{c.upvotesCount}</span>
                    </span>

                    <Link
                      href={`/complaints/${c._id}`}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-0.5"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
