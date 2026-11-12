'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { ChevronsLeftRight } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeDate?: string | Date;
  afterDate?: string | Date;
  beforeAuthor?: string;
  afterAuthor?: string;
  aspectRatio?: 'video' | 'square' | 'wide';
}

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeDate,
  afterDate,
  beforeAuthor,
  afterAuthor,
  aspectRatio = 'video',
}: BeforeAfterSliderProps) {
  const { t } = useTranslation();
  const [position, setPosition] = useState(50); // 0 to 100 %
  const [isDragging, setIsDragging] = useState(false);
  const [beforeError, setBeforeError] = useState(false);
  const [afterError, setAfterError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatDate = (date?: string | Date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setPosition(percentage);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    handleMove(e.clientX);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setPosition((prev) => Math.max(0, prev - 5));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setPosition((prev) => Math.min(100, prev + 5));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setPosition(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setPosition(100);
    }
  };

  let aspectClass = 'aspect-[16/10] sm:aspect-[16/9]';
  if (aspectRatio === 'square') aspectClass = 'aspect-square';
  if (aspectRatio === 'wide') aspectClass = 'aspect-[21/9]';

  return (
    <div className="w-full">
      {/* Visual Comparison Area */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="slider"
        aria-label="Before and after fix slider"
        aria-valuenow={Math.round(position)}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`relative w-full ${aspectClass} overflow-hidden rounded-control border border-border select-none cursor-ew-resize bg-kerb focus-visible:outline focus-visible:outline-2 focus-visible:outline-signboard-blue`}
      >
        {/* Layer 1: "After fix" image (bottom / right side) */}
        <div className="absolute inset-0 w-full h-full bg-kerb flex items-center justify-center">
          {afterError ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-asphalt-subtle bg-kerb p-4 text-center select-none">
              <span className="font-heading font-semibold text-xs text-fixed-green mb-1 uppercase tracking-wider">
                {t.afterFix}
              </span>
              <span className="text-xs font-sans text-asphalt-muted">
                Resolution photo verified on site
              </span>
            </div>
          ) : (
            <Image
              src={afterUrl}
              alt="After resolution fix"
              fill
              sizes="(max-width: 768px) 100vw, 800px"
              className="object-cover"
              priority
              unoptimized={afterUrl.startsWith('data:')}
              onError={() => setAfterError(true)}
            />
          )}
          {/* Label "After fix" */}
          <span className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-plate bg-asphalt/85 text-white font-heading font-semibold text-xs border border-white/20 pointer-events-none">
            {t.afterFix}
          </span>
        </div>

        {/* Layer 2: "Before" image (clipped to slider position) */}
        <div
          className="absolute inset-0 h-full overflow-hidden bg-kerb flex items-center justify-center border-r-2 border-white"
          style={{ width: `${position}%` }}
        >
          <div className="relative w-full h-full">
            {beforeError ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-asphalt-subtle bg-[#e8ebec] p-4 text-center select-none">
                <span className="font-heading font-semibold text-xs text-alert-red mb-1 uppercase tracking-wider">
                  {t.before}
                </span>
                <span className="text-xs font-sans text-asphalt-muted">
                  Reported issue photo on site
                </span>
              </div>
            ) : (
              <Image
                src={beforeUrl}
                alt="Before fix"
                fill
                sizes="(max-width: 768px) 100vw, 800px"
                className="object-cover"
                priority
                unoptimized={beforeUrl.startsWith('data:')}
                onError={() => setBeforeError(true)}
              />
            )}
            {/* Label "Before" */}
            <span className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-plate bg-asphalt/85 text-white font-heading font-semibold text-xs border border-white/20 pointer-events-none">
              {t.before}
            </span>
          </div>
        </div>

        {/* Divider Road Line */}
        <div
          className="absolute top-0 bottom-0 w-[3px] bg-white z-20 pointer-events-none"
          style={{ left: `calc(${position}% - 1.5px)` }}
        />

        {/* Signature Marking Yellow Handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 z-30 flex items-center justify-center w-10 h-10 rounded-control bg-marking-yellow text-asphalt border-2 border-asphalt shadow-slider -ml-5 pointer-events-none transition-transform"
          style={{ left: `${position}%` }}
        >
          <ChevronsLeftRight className="w-5 h-5 stroke-[2.5]" />
        </div>
      </div>

      {/* Date & Attribution Footnotes under each photo */}
      <div className="flex justify-between items-start mt-2 px-1 text-xs text-asphalt-muted font-sans">
        <div>
          <span className="font-heading font-bold text-asphalt block">
            {t.before}
          </span>
          {beforeDate && <span>{formatDate(beforeDate)}</span>}
          {beforeAuthor && (
            <span className="block text-[11px] text-asphalt-subtle">
              by {beforeAuthor}
            </span>
          )}
        </div>

        <div className="text-right">
          <span className="font-heading font-bold text-asphalt block">
            {t.afterFix}
          </span>
          {afterDate && <span>{formatDate(afterDate)}</span>}
          {afterAuthor && (
            <span className="block text-[11px] text-asphalt-subtle">
              by {afterAuthor}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
