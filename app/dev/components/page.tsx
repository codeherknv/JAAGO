'use client';

import React, { useState } from 'react';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ComplaintRow } from '@/components/ui/ComplaintRow';
import { Timeline } from '@/components/ui/Timeline';
import { BeforeAfterSlider } from '@/components/ui/BeforeAfterSlider';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';
import { useTranslation } from '@/lib/i18n';

export default function DevComponentsPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }
  const { t, lang } = useTranslation();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [supportCount, setSupportCount] = useState(14);
  const [hasSupported, setHasSupported] = useState(false);

  const sampleStatusHistory = [
    {
      status: 'Pending',
      actorId: 'user-1',
      role: 'citizen',
      timestamp: new Date(Date.now() - 72 * 3600 * 1000),
      remarks: 'Initial report filed with geo-tagged photograph.',
    },
    {
      status: 'In Progress',
      actorId: 'officer-1',
      role: 'officer',
      timestamp: new Date(Date.now() - 36 * 3600 * 1000),
      remarks: 'Inspection completed. Precast slab ordered from BBMP depot.',
    },
    {
      status: 'Pending Verification',
      actorId: 'officer-1',
      role: 'officer',
      timestamp: new Date(Date.now() - 12 * 3600 * 1000),
      remarks: 'New RCC reinforced slab placed and cemented. Photo uploaded.',
      locationAccuracy: 6.8,
      resolutionDistanceMeters: 14,
      imageUrl: 'https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/drain_resolved.jpg',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
      {/* Header */}
      <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-heading font-medium text-asphalt-muted px-2 py-0.5 bg-kerb rounded-plate border border-border">
            Component Library &bull; Design Tokens
          </span>
          <h1 className="text-2xl font-heading font-bold text-asphalt mt-1">
            Calm Street Infrastructure
          </h1>
          <p className="text-xs text-asphalt-muted mt-0.5">
            Design tokens, signature elements, and reusable components.
          </p>
        </div>
        <div>
          <LanguageSwitch />
        </div>
      </div>

      {/* 1. Colour Tokens */}
      <section className="space-y-3">
        <h2 className="text-sm font-heading font-bold text-asphalt">
          1. Named Colour Tokens
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-white rounded-control border border-border">
            <div className="w-full h-8 bg-asphalt rounded-plate mb-2" />
            <p className="text-xs font-heading font-bold text-asphalt">Asphalt</p>
            <p className="text-[11px] text-asphalt-muted font-mono">#23272B (Text)</p>
          </div>

          <div className="p-3 bg-white rounded-control border border-border">
            <div className="w-full h-8 bg-kerb border border-border rounded-plate mb-2" />
            <p className="text-xs font-heading font-bold text-asphalt">Kerb</p>
            <p className="text-[11px] text-asphalt-muted font-mono">#F2F4F3 (Page)</p>
          </div>

          <div className="p-3 bg-white rounded-control border border-border">
            <div className="w-full h-8 bg-marking-yellow rounded-plate mb-2" />
            <p className="text-xs font-heading font-bold text-asphalt">Marking Yellow</p>
            <p className="text-[11px] text-asphalt-muted font-mono">#F2B705 (Action)</p>
          </div>

          <div className="p-3 bg-white rounded-control border border-border">
            <div className="w-full h-8 bg-signboard-blue rounded-plate mb-2" />
            <p className="text-xs font-heading font-bold text-asphalt">Signboard Blue</p>
            <p className="text-[11px] text-asphalt-muted font-mono">#0B5D8C (Links)</p>
          </div>

          <div className="p-3 bg-white rounded-control border border-border">
            <div className="w-full h-8 bg-fixed-green rounded-plate mb-2" />
            <p className="text-xs font-heading font-bold text-asphalt">Fixed Green</p>
            <p className="text-[11px] text-asphalt-muted font-mono">#1E8E5A (Resolved)</p>
          </div>

          <div className="p-3 bg-white rounded-control border border-border">
            <div className="w-full h-8 bg-alert-red rounded-plate mb-2" />
            <p className="text-xs font-heading font-bold text-asphalt">Alert Red</p>
            <p className="text-[11px] text-asphalt-muted font-mono">#C8372D (Status/Error)</p>
          </div>

          <div className="p-3 bg-white rounded-control border border-border">
            <div className="w-full h-8 bg-attention-amber rounded-plate mb-2" />
            <p className="text-xs font-heading font-bold text-asphalt">Attention Amber</p>
            <p className="text-[11px] text-asphalt-muted font-mono">#D97706 (Open/Queue)</p>
          </div>

          <div className="p-3 bg-white rounded-control border border-border">
            <div className="w-full h-8 bg-border rounded-plate mb-2" />
            <p className="text-xs font-heading font-bold text-asphalt">Border Slate</p>
            <p className="text-[11px] text-asphalt-muted font-mono">#D9DFE2 (Borders)</p>
          </div>
        </div>
      </section>

      {/* 2. Typography Scale */}
      <section className="space-y-3">
        <h2 className="text-sm font-heading font-bold text-asphalt">
          2. Typography Scale &amp; Language Adaptation
        </h2>
        <div className="p-4 bg-white rounded-control border border-border space-y-4">
          <div>
            <span className="text-[10px] text-asphalt-muted font-mono">Display / Archivo Bold</span>
            <p className="text-2xl font-heading font-bold text-asphalt">
              Open drain cover on 27th Main Road
            </p>
            <p className="text-2xl font-kannada font-bold text-asphalt mt-1">
              27ನೇ ಮುಖ್ಯ ರಸ್ತೆಯಲ್ಲಿ ತೆರೆದ ಚರಂಡಿ ಮುಚ್ಚಳ
            </p>
          </div>

          <div>
            <span className="text-[10px] text-asphalt-muted font-mono">Heading 2 / Archivo SemiBold</span>
            <p className="text-lg font-heading font-semibold text-asphalt">
              Civic Trust Index: 88 / 100 &bull; Bellandur Ward 150
            </p>
          </div>

          <div>
            <span className="text-[10px] text-asphalt-muted font-mono">Body / Noto Sans (Under 70 chars per line, left-aligned)</span>
            <p className="text-sm text-asphalt max-w-prose">
              The assigned municipal engineer recorded resolution on-site with verified GPS coordinates. Citizens have 120 hours to confirm or contest this repair before automatic closure.
            </p>
            <p className="text-sm font-kannada text-asphalt max-w-prose mt-1">
              ನಿಯೋಜಿತ ನಗರ ಎಂಜಿನಿಯರ್ ಪರಿಶೀಲಿಸಿದ ಜಿಪಿಎಸ್ ನಿರ್ದೇಶಾಂಕಗಳೊಂದಿಗೆ ಸ್ಥಳದಲ್ಲೇ ಪರಿಹಾರವನ್ನು ದಾಖಲಿಸಿದ್ದಾರೆ. ಸ್ವಯಂಚಾಲಿತ ಮುಕ್ತಾಯಕ್ಕೆ ಮುನ್ನ ಈ ದುರಸ್ತಿಯನ್ನು ದೃಢೀಕರಿಸಲು ಅಥವಾ ಆಕ್ಷೇಪಿಸಲು ನಾಗರಿಕರಿಗೆ 120 ಗಂಟೆಗಳ ಕಾಲಾವಕಾಶವಿದೆ.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Buttons */}
      <section className="space-y-3">
        <h2 className="text-sm font-heading font-bold text-asphalt">
          3. Button Variants (44px Minimum Tap Targets)
        </h2>
        <div className="p-4 bg-white rounded-control border border-border flex flex-wrap gap-3 items-center">
          <Button variant="primary">{t.reportProblem}</Button>
          <Button variant="secondary">{t.supportReport}</Button>
          <Button variant="destructive">{t.notFixed}</Button>
          <Button variant="ghost">{t.cancel}</Button>
          <Button variant="primary" disabled>
            Disabled state
          </Button>
          <Button variant="primary" size="sm">
            Small
          </Button>
          <Button variant="primary" size="lg">
            Large action
          </Button>
        </div>
      </section>

      {/* 4. Status Badges */}
      <section className="space-y-3">
        <h2 className="text-sm font-heading font-bold text-asphalt">
          4. StatusBadges (Shape-Coded Icon + Text + Colour)
        </h2>
        <div className="p-4 bg-white rounded-control border border-border flex flex-wrap gap-2.5">
          <StatusBadge status="Pending" />
          <StatusBadge status="In Progress" />
          <StatusBadge status="Pending Verification" />
          <StatusBadge status="Resolved - Citizen Verified" />
          <StatusBadge status="Resolved - Auto Closed" />
          <StatusBadge status="Reopened - Escalated" />
          <StatusBadge status="Disputed - Admin Review" />
          <StatusBadge status="Rejected - Invalid" />
        </div>
      </section>

      {/* 5. ComplaintRow */}
      <section className="space-y-3">
        <h2 className="text-sm font-heading font-bold text-asphalt">
          5. ComplaintRow (Flat 1px-Divided List Row, Not a Card)
        </h2>
        <div className="bg-white rounded-control border border-border overflow-hidden">
          <ComplaintRow
            id="sample-1"
            title="Broken stormwater drain cover on 80 Feet Road"
            address="80 Feet Rd, 4th Block, Koramangala, Bengaluru"
            category="Water Supply & Drainage"
            status="Pending Verification"
            distanceMeters={18}
            imageUrl="https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/drain.jpg"
            upvotesCount={supportCount}
            hasUpvoted={hasSupported}
            onUpvote={() => {
              setHasSupported(!hasSupported);
              setSupportCount(hasSupported ? supportCount - 1 : supportCount + 1);
            }}
          />

          <ComplaintRow
            id="sample-2"
            title="Overflowing black spot garbage along 27th Main"
            address="27th Main Rd, Sector 1, HSR Layout, Bengaluru"
            category="Sanitation"
            status="In Progress"
            distanceMeters={42}
            imageUrl="https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/garbage.jpg"
            upvotesCount={8}
            hasUpvoted={false}
          />

          <ComplaintRow
            id="sample-3"
            title="Streetlights non-functional along Haralur Link Road"
            address="Haralur Main Rd, Bellandur, Bengaluru"
            category="Streetlights"
            status="Resolved - Citizen Verified"
            distanceMeters={110}
            imageUrl="https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/light.jpg"
            upvotesCount={22}
            hasUpvoted={true}
          />
        </div>
      </section>

      {/* 6. BeforeAfterSlider */}
      <section className="space-y-3">
        <h2 className="text-sm font-heading font-bold text-asphalt">
          6. BeforeAfterSlider (Interactive Road Repair Comparison)
        </h2>
        <div className="bg-white p-4 rounded-control border border-border">
          <BeforeAfterSlider
            beforeUrl="https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/drain.jpg"
            afterUrl="https://res.cloudinary.com/jaago-pilot/image/upload/v1700000000/jaago_complaints/drain_resolved.jpg"
            beforeDate={new Date(Date.now() - 72 * 3600 * 1000)}
            afterDate={new Date(Date.now() - 12 * 3600 * 1000)}
            beforeAuthor="Citizen Rahul"
            afterAuthor="Insp. Ramesh Gowda"
          />
        </div>
      </section>

      {/* 7. Timeline */}
      <section className="space-y-3">
        <h2 className="text-sm font-heading font-bold text-asphalt">
          7. Timeline (Road Centre-Line Motif)
        </h2>
        <div className="bg-white p-4 rounded-control border border-border">
          <Timeline
            statusHistory={sampleStatusHistory}
            currentStatus="Pending Verification"
          />
        </div>
      </section>

      {/* 8. BottomSheet Trigger & Demonstration */}
      <section className="space-y-3">
        <h2 className="text-sm font-heading font-bold text-asphalt">
          8. BottomSheet Component
        </h2>
        <div className="p-4 bg-white rounded-control border border-border flex items-center justify-between">
          <div>
            <p className="text-sm font-heading font-semibold text-asphalt">
              Three-step bottom sheet demo
            </p>
            <p className="text-xs text-asphalt-muted">
              Used for mobile report creation and quick actions.
            </p>
          </div>
          <Button variant="primary" onClick={() => setIsSheetOpen(true)}>
            Open demo sheet
          </Button>
        </div>

        <BottomSheet
          isOpen={isSheetOpen}
          onClose={() => setIsSheetOpen(false)}
          title="Report a problem"
          stepIndicator="Step 1 of 3"
        >
          <div className="space-y-4 py-2">
            <p className="text-xs text-asphalt-muted">
              This bottom sheet slides up on mobile and centers on desktop.
            </p>
            <div className="p-4 bg-kerb rounded-control border border-border text-center">
              <p className="text-xs font-heading font-semibold text-asphalt">
                Outdoor camera viewfinder placeholder
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" fullWidth onClick={() => setIsSheetOpen(false)}>
                {t.cancel}
              </Button>
              <Button variant="primary" fullWidth onClick={() => setIsSheetOpen(false)}>
                {t.next}
              </Button>
            </div>
          </div>
        </BottomSheet>
      </section>

      {/* 9. Empty States & Skeletons */}
      <section className="space-y-3">
        <h2 className="text-sm font-heading font-bold text-asphalt">
          9. Empty State &amp; Skeletons
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EmptyState
            title={t.emptyNearYou}
            description="Be the first to flag potholes, broken streetlights, or waste accumulation in this ward."
            actionLabel={t.reportProblem}
            onAction={() => alert('Report clicked')}
          />

          <div className="bg-white rounded-control border border-border overflow-hidden">
            <Skeleton variant="row" />
            <Skeleton variant="row" />
          </div>
        </div>
      </section>
    </div>
  );
}
