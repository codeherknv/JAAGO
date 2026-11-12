'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from './ui/Skeleton';

interface LocationMiniMapProps {
  lat: number;
  lng: number;
  accuracy?: number;
}

// Dynamically import Leaflet with ssr: false
const LeafletMap = dynamic(
  async () => {
    const { MapContainer, TileLayer, Marker, Circle } = await import('react-leaflet');
    const L = (await import('leaflet')).default;

    // Custom street marker icon
    const pinHtml = `
      <div style="position:relative; width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
        <div style="width:20px; height:20px; border-radius:50%; background-color:#F2B705; border:3px solid #23272B; box-shadow:0 2px 8px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center;">
          <div style="width:6px; height:6px; border-radius:50%; background-color:#23272B;"></div>
        </div>
      </div>
    `;

    const customPin = L.divIcon({
      html: pinHtml,
      className: 'jaago-minimap-marker',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    return function InnerMap({ lat, lng, accuracy }: LocationMiniMapProps) {
      return (
        <MapContainer
          center={[lat, lng]}
          zoom={16}
          scrollWheelZoom={false}
          dragging={false}
          zoomControl={false}
          attributionControl={false}
          className="w-full h-full rounded-control"
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
          <Marker position={[lat, lng]} icon={customPin} />
          {accuracy && accuracy > 0 && (
            <Circle
              center={[lat, lng]}
              radius={accuracy}
              pathOptions={{
                color: '#0B5D8C',
                fillColor: '#0B5D8C',
                fillOpacity: 0.12,
                weight: 1.5,
              }}
            />
          )}
        </MapContainer>
      );
    };
  },
  {
    ssr: false,
    loading: () => <Skeleton variant="map" className="h-44 w-full" />,
  }
);

export function LocationMiniMap({ lat, lng, accuracy }: LocationMiniMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <Skeleton variant="map" className="h-44 w-full" />;
  }

  return (
    <div className="relative w-full h-44 rounded-control overflow-hidden border border-border">
      <LeafletMap lat={lat} lng={lng} accuracy={accuracy} />
    </div>
  );
}
