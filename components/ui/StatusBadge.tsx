'use client';

import React from 'react';
import {
  Clock,
  Hammer,
  Eye,
  CheckSquare,
  CheckCheck,
  AlertTriangle,
  Scale,
  XOctagon,
} from 'lucide-react';
import { ComplaintStatus } from '@/models/Complaint';
import { useTranslation } from '@/lib/i18n';

interface StatusBadgeProps {
  status: ComplaintStatus | string;
  className?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, className = '', size = 'md' }: StatusBadgeProps) {
  const { t } = useTranslation();

  // Shape-coded icon, colour palette and accessible semantic label
  let icon = <Clock className="w-3.5 h-3.5 shrink-0" />;
  let label = status;
  let styleClasses = 'bg-attention-light text-asphalt border-[#E6B800]';

  switch (status) {
    case 'Pending':
      icon = <Clock className="w-3.5 h-3.5 shrink-0 text-attention-amber" />;
      label = t.pending;
      styleClasses = 'bg-attention-light text-asphalt border-attention-amber/40';
      break;

    case 'In Progress':
      icon = <Hammer className="w-3.5 h-3.5 shrink-0 text-attention-amber" />;
      label = t.inProgress;
      styleClasses = 'bg-attention-light text-asphalt border-attention-amber/50';
      break;

    case 'Pending Verification':
      icon = <Eye className="w-3.5 h-3.5 shrink-0 text-signboard-blue" />;
      label = t.pendingVerification;
      styleClasses = 'bg-signboard-light text-signboard-blue border-signboard-blue/40 font-semibold';
      break;

    case 'Resolved - Citizen Verified':
      icon = <CheckSquare className="w-3.5 h-3.5 shrink-0 text-fixed-green" />;
      label = t.resolvedCitizenVerified;
      styleClasses = 'bg-fixed-light text-fixed-green border-fixed-green/40 font-semibold';
      break;

    case 'Resolved - Auto Closed':
      icon = <CheckCheck className="w-3.5 h-3.5 shrink-0 text-fixed-green" />;
      label = t.resolvedAutoClosed;
      styleClasses = 'bg-fixed-light text-fixed-green border-fixed-green/40';
      break;

    case 'Reopened - Escalated':
      icon = <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-purple-700" />;
      label = t.reopenedEscalated;
      styleClasses = 'bg-purple-50 text-purple-800 border-purple-300 font-semibold';
      break;

    case 'Disputed - Admin Review':
      icon = <Scale className="w-3.5 h-3.5 shrink-0 text-purple-700" />;
      label = t.disputedAdminReview;
      styleClasses = 'bg-purple-100 text-purple-900 border-purple-400 font-bold';
      break;

    case 'Rejected - Invalid':
      icon = <XOctagon className="w-3.5 h-3.5 shrink-0 text-asphalt-muted" />;
      label = t.rejectedInvalid;
      styleClasses = 'bg-kerb-dark text-asphalt-muted border-border';
      break;
  }

  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-[11px] gap-1' : 'px-2 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-plate border font-heading ${padding} ${styleClasses} ${className}`}
      role="status"
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}
