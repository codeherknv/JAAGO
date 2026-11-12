'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ThumbsUp, MapPin } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { Button } from './Button';
import { useTranslation } from '@/lib/i18n';

export interface ComplaintRowProps {
  id: string;
  title: string;
  address: string;
  category: string;
  status: string;
  distanceMeters?: number;
  imageUrl?: string;
  upvotesCount: number;
  hasUpvoted?: boolean;
  onUpvote?: (e: React.MouseEvent) => void;
  actionButton?: React.ReactNode;
  showSupportAction?: boolean;
}

export function ComplaintRow({
  id,
  title,
  address,
  category,
  status,
  distanceMeters,
  imageUrl,
  upvotesCount,
  hasUpvoted = false,
  onUpvote,
  actionButton,
  showSupportAction = true,
}: ComplaintRowProps) {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);

  return (
    <div className="group relative bg-white border-b border-border py-3.5 px-4 transition-colors hover:bg-kerb/50">
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <Link href={`/complaints/${id}`} className="shrink-0 relative w-14 h-14 bg-kerb rounded-control overflow-hidden border border-border">
          {imageUrl && !imgError ? (
            <Image
              src={imageUrl}
              alt={title}
              fill
              sizes="56px"
              className="object-cover"
              unoptimized={imageUrl.startsWith('data:')}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-asphalt-subtle bg-kerb">
              <MapPin className="w-5 h-5" />
            </div>
          )}
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusBadge status={status} size="sm" />
            <span className="text-[11px] font-heading font-medium text-asphalt-muted px-1.5 py-0.5 bg-kerb rounded-plate border border-border-subtle">
              {category}
            </span>
          </div>

          <Link href={`/complaints/${id}`} className="block focus-visible:outline-none">
            <h4 className="text-sm font-heading font-bold text-asphalt leading-snug line-clamp-2 group-hover:text-signboard-blue transition-colors">
              {title}
            </h4>
          </Link>

          <p className="text-xs text-asphalt-muted mt-1 flex items-center gap-1.5 line-clamp-1">
            <span className="truncate">{address}</span>
            {distanceMeters !== undefined && (
              <span className="shrink-0 font-medium text-asphalt font-heading">
                &bull; {Math.round(distanceMeters)} m
              </span>
            )}
          </p>
        </div>

        {/* Right side: Custom action button or Support button */}
        <div className="shrink-0 self-center">
          {actionButton ? (
            actionButton
          ) : showSupportAction ? (
            <button
              onClick={onUpvote}
              className={`flex flex-col items-center justify-center min-w-[50px] min-h-[44px] px-2.5 py-1.5 rounded-control border text-xs font-heading font-semibold transition-colors ${
                hasUpvoted
                  ? 'bg-marking-yellow text-asphalt border-[#D9A304]'
                  : 'bg-white hover:bg-kerb text-asphalt-muted border-border active:bg-kerb-dark'
              }`}
              title={t.supportReport}
              aria-label={`${t.supportReport} (${upvotesCount})`}
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${hasUpvoted ? 'fill-asphalt text-asphalt' : ''}`} />
              <span className="text-[11px] mt-0.5">{upvotesCount}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
