'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { CheckCircle2, Clock, MapPin, Wrench, ShieldCheck, AlertCircle } from 'lucide-react';
import { IStatusHistory } from '@/models/Complaint';
import { useTranslation } from '@/lib/i18n';

export interface TimelineProps {
  statusHistory: IStatusHistory[] | any[];
  currentStatus: string;
}

export function Timeline({ statusHistory = [], currentStatus }: TimelineProps) {
  const { t } = useTranslation();

  // Helper to format role in plain civic language
  const getActorLabel = (role: string) => {
    switch (role) {
      case 'citizen':
        return 'Citizen';
      case 'officer':
        return 'Field Officer';
      case 'admin':
        return 'Municipal Admin';
      case 'system':
        return 'Automated System';
      default:
        return 'Staff';
    }
  };

  const formatDate = (ts: Date | string) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Determine future projected milestones
  const isResolvedOrVerifying = [
    'Pending Verification',
    'Resolved - Citizen Verified',
    'Resolved - Auto Closed',
    'Disputed - Admin Review',
  ].includes(currentStatus);

  const isClosed = [
    'Resolved - Citizen Verified',
    'Resolved - Auto Closed',
    'Rejected - Invalid',
  ].includes(currentStatus);

  return (
    <div className="relative pl-6 py-2">
      {/* Road Centre-line: Vertical asphalt line */}
      <div
        className="absolute left-[11px] top-4 bottom-4 w-[3px] bg-asphalt"
        aria-hidden="true"
      />

      <div className="space-y-6">
        {statusHistory.map((item, idx) => {
          const isLatest = idx === statusHistory.length - 1;
          const isResolution =
            item.status === 'Pending Verification' ||
            item.status?.startsWith('Resolved');

          return (
            <div key={idx} className="relative flex items-start gap-4">
              {/* Milestone Node */}
              <div
                className={`relative z-10 flex items-center justify-center w-6 h-6 -ml-6 rounded-plate border-2 ${
                  isLatest
                    ? 'bg-marking-yellow border-asphalt text-asphalt'
                    : 'bg-white border-asphalt text-asphalt-muted'
                }`}
              >
                {isResolution ? (
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : item.role === 'officer' ? (
                  <Wrench className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                  <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
              </div>

              {/* Event Content */}
              <div className="flex-1 bg-white p-3.5 rounded-control border border-border">
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-heading font-bold text-asphalt">
                      {item.status}
                    </span>
                    <span className="text-[11px] font-heading font-medium text-asphalt-muted px-1.5 py-0.5 bg-kerb rounded-plate border border-border-subtle">
                      {getActorLabel(item.role)}
                    </span>
                  </div>
                  <time className="text-[11px] text-asphalt-muted font-medium">
                    {formatDate(item.timestamp)}
                  </time>
                </div>

                {item.remarks && (
                  <p className="text-xs text-asphalt mt-1.5 leading-relaxed font-sans">
                    {item.remarks}
                  </p>
                )}

                {item.locationAccuracy !== undefined && (
                  <p className="text-[11px] text-asphalt-muted mt-1.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-signboard-blue shrink-0" />
                    <span>GPS accuracy: &plusmn;{Math.round(item.locationAccuracy)} m</span>
                    {item.resolutionDistanceMeters !== undefined && (
                      <span>({Math.round(item.resolutionDistanceMeters)} m from issue)</span>
                    )}
                  </p>
                )}

                {item.imageUrl && (
                  <TimelineThumbnail src={item.imageUrl} />
                )}
              </div>
            </div>
          );
        })}

        {/* Projected Future Road: Dashed line indicating upcoming milestones */}
        {!isClosed && (
          <div className="relative flex items-start gap-4 opacity-75">
            {/* Dashed connector */}
            <div
              className="absolute left-[11px] -top-6 bottom-4 w-[3px] border-l-[3px] border-dashed border-asphalt-subtle"
              aria-hidden="true"
            />

            <div className="relative z-10 flex items-center justify-center w-6 h-6 -ml-6 rounded-plate bg-kerb border-2 border-dashed border-asphalt-subtle text-asphalt-subtle">
              <Clock className="w-3.5 h-3.5" />
            </div>

            <div className="flex-1 bg-kerb/60 p-3 rounded-control border border-dashed border-border text-asphalt-muted">
              <p className="text-xs font-heading font-semibold text-asphalt-muted">
                {!isResolvedOrVerifying
                  ? 'Next: Field inspection & proof of fix'
                  : 'Next: 5-day citizen verification & audit'}
              </p>
              <p className="text-[11px] text-asphalt-muted mt-0.5">
                {!isResolvedOrVerifying
                  ? 'Assigned officer will visit on-site and upload verified proof.'
                  : 'Citizens confirm resolution or contest within 120 hours.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineThumbnail({ src }: { src: string }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className="mt-2.5 flex items-center gap-1.5 p-2 rounded-plate bg-kerb border border-border text-[11px] text-asphalt-muted">
        <MapPin className="w-3.5 h-3.5 text-signboard-blue shrink-0" />
        <span>Proof photograph recorded on site</span>
      </div>
    );
  }
  return (
    <div className="mt-2.5 relative w-24 h-24 rounded-control overflow-hidden border border-border bg-kerb">
      <Image
        src={src}
        alt="Action proof"
        fill
        sizes="96px"
        className="object-cover"
        unoptimized={src.startsWith('data:')}
        onError={() => setError(true)}
      />
    </div>
  );
}
