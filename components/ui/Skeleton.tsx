'use client';

import React from 'react';

export interface SkeletonProps {
  className?: string;
  variant?: 'rectangular' | 'text' | 'row' | 'map';
}

export function Skeleton({ className = '', variant = 'rectangular' }: SkeletonProps) {
  if (variant === 'row') {
    return (
      <div className="flex items-center gap-3 py-3.5 px-4 bg-white border-b border-border animate-pulse">
        <div className="w-14 h-14 bg-border/60 rounded-control shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="w-24 h-4 bg-border/60 rounded-plate" />
          <div className="w-3/4 h-4 bg-border/60 rounded-plate" />
          <div className="w-1/2 h-3 bg-border/40 rounded-plate" />
        </div>
        <div className="w-12 h-10 bg-border/40 rounded-control shrink-0" />
      </div>
    );
  }

  if (variant === 'map') {
    return (
      <div className="relative w-full h-[400px] bg-kerb rounded-control border border-border overflow-hidden animate-pulse flex items-center justify-center">
        <div className="text-xs text-asphalt-subtle font-heading">
          Loading road and ward boundaries...
        </div>
      </div>
    );
  }

  if (variant === 'text') {
    return <div className={`h-4 bg-border/60 rounded-plate animate-pulse ${className}`} />;
  }

  return (
    <div className={`bg-border/60 rounded-control animate-pulse ${className}`} />
  );
}
