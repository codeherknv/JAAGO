'use client';

import React from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface CivicLeafletMapProps {
  complaints: any[];
  wards: any[];
  selectedCategory: string;
  selectedWardId: string;
  onSelectComplaint?: (complaint: any) => void;
  selectedComplaintId?: string | null;
  heightClass?: string;
}

/**
 * Shape AND color-coded status marker using L.divIcon
 * - Pending: Circle (alert red #C8372D)
 * - In Progress: Square Plate (marking yellow #F2B705 with dark asphalt core)
 * - Pending Verification: Diamond / Shield (signboard blue #0B5D8C with white center)
 * - Resolved: Octagon / Enamel Plate (fixed green #1E8E5A with check dot)
 * - Reopened / Disputed: Red alert square with warning pulse
 */
function createStatusIcon(status: string, isSelected: boolean = false) {
  let shapeHtml = '';
  const size = isSelected ? 34 : 26;
  const ring = isSelected ? 'box-shadow: 0 0 0 3px #F2B705, 0 4px 10px rgba(0,0,0,0.3);' : 'box-shadow: 0 2px 5px rgba(0,0,0,0.25);';

  if (status === 'Pending') {
    // Circle: Alert Red
    shapeHtml = `
      <div style="width:${size}px; height:${size}px; border-radius:50%; background-color:#C8372D; border:2px solid #FFFFFF; display:flex; align-items:center; justify-content:center; ${ring}">
        <div style="width:7px; height:7px; border-radius:50%; background-color:#FFFFFF;"></div>
      </div>
    `;
  } else if (status === 'In Progress') {
    // Square plate: Marking Yellow with Asphalt core
    shapeHtml = `
      <div style="width:${size}px; height:${size}px; border-radius:2px; background-color:#F2B705; border:2px solid #23272B; display:flex; align-items:center; justify-content:center; ${ring}">
        <div style="width:7px; height:7px; border-radius:1px; background-color:#23272B;"></div>
      </div>
    `;
  } else if (status === 'Pending Verification') {
    // Diamond / Shield: Signboard Blue with White core
    shapeHtml = `
      <div style="width:${size}px; height:${size}px; border-radius:2px; transform: rotate(45deg); background-color:#0B5D8C; border:2px solid #FFFFFF; display:flex; align-items:center; justify-content:center; ${ring}">
        <div style="width:6px; height:6px; background-color:#FFFFFF; border-radius:1px;"></div>
      </div>
    `;
  } else if (status.startsWith('Resolved')) {
    // Octagon / Fixed Green plate with check dot
    shapeHtml = `
      <div style="width:${size}px; height:${size}px; border-radius:4px; background-color:#1E8E5A; border:2px solid #FFFFFF; display:flex; align-items:center; justify-content:center; ${ring}">
        <div style="width:6px; height:6px; border-radius:50%; background-color:#FFFFFF;"></div>
      </div>
    `;
  } else {
    // Reopened / Disputed: Alert Red badge with asphalt border
    shapeHtml = `
      <div style="width:${size}px; height:${size}px; border-radius:2px; background-color:#C8372D; border:2px solid #23272B; display:flex; align-items:center; justify-content:center; ${ring}">
        <div style="width:7px; height:7px; border-radius:1px; background-color:#F2B705;"></div>
      </div>
    `;
  }

  const html = `
    <div style="position:relative; width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
      ${shapeHtml}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-status-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export default function CivicLeafletMap({
  complaints,
  wards,
  selectedCategory,
  selectedWardId,
  onSelectComplaint,
  selectedComplaintId,
  heightClass = 'h-full',
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
    <div className={`relative w-full ${heightClass} overflow-hidden bg-kerb`}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        {/* Muted low-saturation base tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Render Bengaluru Pilot Ward Boundaries */}
        {wards.map((ward) => {
          if (!ward.boundary?.coordinates) return null;
          // In GeoJSON, coordinates are [lng, lat]; Leaflet Polygon expects [lat, lng]
          const leafletPositions = ward.boundary.coordinates[0].map(
            (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
          );

          const isSelectedWard = selectedWardId === ward._id;

          return (
            <Polygon
              key={ward._id}
              positions={leafletPositions}
              pathOptions={{
                color: isSelectedWard ? '#0B5D8C' : '#5A6065',
                weight: isSelectedWard ? 2.5 : 1.5,
                dashArray: isSelectedWard ? undefined : '4, 4',
                fillColor: isSelectedWard ? '#0B5D8C' : '#8A9096',
                fillOpacity: isSelectedWard ? 0.12 : 0.04,
              }}
            >
              <Tooltip direction="center" permanent={false} opacity={0.9}>
                <div className="font-heading font-bold text-xs text-asphalt">
                  {ward.name} ({ward.code})
                </div>
              </Tooltip>
            </Polygon>
          );
        })}

        {/* Render Status Complaint Markers */}
        {filteredComplaints.map((c) => {
          if (!c.location?.coordinates) return null;
          const [lng, lat] = c.location.coordinates;
          const isSelected = selectedComplaintId === c._id;
          const icon = createStatusIcon(c.status, isSelected);

          return (
            <Marker
              key={c._id}
              position={[lat, lng]}
              icon={icon}
              eventHandlers={{
                click: () => {
                  if (onSelectComplaint) {
                    onSelectComplaint(c);
                  }
                },
              }}
            >
              <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
                <div className="font-sans text-xs max-w-[200px] p-0.5">
                  <div className="font-heading font-bold text-asphalt text-xs line-clamp-1">
                    {c.title}
                  </div>
                  <div className="text-[11px] text-asphalt-muted">
                    {c.status} • {c.category}
                  </div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
