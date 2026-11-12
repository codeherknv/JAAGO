# Jaago Design System & UX Plan: Calm Street Infrastructure

## 1. Product & Context
Jaago is a public civic complaint tracker and accountability platform piloted for Greater Bengaluru (Wards: Bellandur, HSR Layout, Koramangala).

### Primary Users:
1. **Citizens on Mobile:** Outdoors under harsh tropical daylight, often walking, holding a phone one-handed. Need instant photo capture, clear GPS accuracy feedback, effortless duplicate checking, and one-tap voting or verification.
2. **Field Officers:** On mobile in the field and office desktop monitors. Need unambiguous on-site location validation, instant before/after proof submission, and high-contrast status queues.
3. **The Public & Municipal Observers:** Examining the spatial map, Civic Trust Index (CTI) ward scorecards, and audit trails.

### Aesthetic Direction:
**Calm Street Infrastructure.** Clean, high-legibility, utilitarian, confident. Inspired by physical signage, asphalt surfaces, painted roadway centerlines, and Bengaluru municipal mile-markers. Not a glossy venture-backed SaaS template; a dependable public utility.

---

## 2. Design Tokens

### 2.1 Named Colour Tokens
| Token Name | Hex | Usage |
| :--- | :--- | :--- |
| `color-asphalt` | `#23272B` | Primary body text, headings, dark icon glyphs |
| `color-asphalt-muted` | `#5A626A` | Secondary text, helper labels, timestamps, road line inactive |
| `color-asphalt-subtle` | `#8C959E` | Tertiary text, placeholder text, dashed timeline lines |
| `color-kerb` | `#F2F4F3` | Page background, unselected control backgrounds |
| `color-white` | `#FFFFFF` | Raised surfaces (sheets, panels, modals), button contrast text |
| `color-border` | `#D9DFE2` | Structural borders, row dividers, input outlines |
| `color-border-subtle` | `#E7ECEE` | Secondary dividers, internal table cell borders |
| `color-marking-yellow` | `#F2B705` | Primary action button, floating report button, slider handle |
| `color-marking-yellow-hover` | `#D9A304` | Hover / active state for primary action |
| `color-signboard-blue` | `#0B5D8C` | Text links, 'Pending Verification' status badge, informational notices |
| `color-signboard-blue-light` | `#E8F2F8` | Background tint for blue status plates and notices |
| `color-fixed-green` | `#1E8E5A` | 'Resolved - Citizen Verified' and 'Resolved - Auto Closed' status |
| `color-fixed-green-light` | `#EAF6F0` | Background tint for green status plates |
| `color-alert-red` | `#C8372D` | 'Rejected - Invalid', overdue SLA markers, error messages |
| `color-alert-red-light` | `#FBEBEA` | Background tint for red alert plates |
| `color-attention-amber` | `#D97706` | 'Pending', 'In Progress', 'Reopened - Escalated' status |
| `color-attention-amber-light` | `#FEF3C7` | Background tint for amber status plates |

### 2.2 Typography Scale
- **Display & Headings:** `Archivo` (variable width/weight, deliberate tracking, tight at large sizes).
- **Body & Controls:** `Noto Sans` (English) + `Noto Sans Kannada` (Kannada script).
- **Kannada Rule:** Kannada script rendered at `+1px` font-size relative to English with a minimum `line-height` of `1.65`.
- **Formatting Rules:**
  - Sentence case everywhere (no ALL-CAPS uppercase tracking).
  - Body text column max-width: `< 70ch`.
  - Left-aligned text; no centered narrative blocks.

| Scale Token | Font Family | Size / Line Height (EN) | Size / Line Height (KN) | Weight / Tracking |
| :--- | :--- | :--- | :--- | :--- |
| `text-display` | Archivo | 26px / 32px | 27px / 36px | Bold (700), -0.02em |
| `text-h1` | Archivo | 20px / 26px | 21px / 30px | Bold (700), -0.015em |
| `text-h2` | Archivo | 17px / 22px | 18px / 26px | SemiBold (600), -0.01em |
| `text-h3` | Archivo | 15px / 20px | 16px / 24px | SemiBold (600), normal |
| `text-body` | Noto Sans | 14px / 20px | 15px / 25px | Regular (400), normal |
| `text-body-bold` | Noto Sans | 14px / 20px | 15px / 25px | SemiBold (600), normal |
| `text-caption` | Noto Sans | 12px / 16px | 13px / 22px | Regular (400), normal |
| `text-plate` | Archivo | 11px / 14px | 12px / 18px | Medium (500), +0.01em |

### 2.3 Spacing Scale
- `space-1`: 4px
- `space-2`: 8px
- `space-3`: 12px
- `space-4`: 16px
- `space-5`: 20px
- `space-6`: 24px
- `space-8`: 32px
- `space-12`: 48px

### 2.4 Radius Rules
- `radius-plate`: `2px` for status badges, tags, and category chips.
- `radius-control`: `8px` for bottom sheets, form inputs, dialogs, and standard buttons.
- `radius-full`: `9999px` strictly for user avatars, camera shutter button, and the floating report action button.
- `radius-none`: `0px` for list rows, table grids, and structural road lines.

### 2.5 Elevation & Surfaces
- Surfaces are kept flat and clean. Content is organized by thin structural borders (`1px solid #D9DFE2`) and kerb/white contrast.
- Shadows are reserved strictly for floating/elevated overlays:
  - `shadow-sheet`: `0 -4px 20px rgba(35, 39, 43, 0.12)` (Bottom sheets)
  - `shadow-float`: `0 2px 10px rgba(35, 39, 43, 0.15)` (Floating report button & map zoom controls)
  - `shadow-slider`: `0 0 8px rgba(0, 0, 0, 0.25)` (Before/after drag handle)

### 2.6 Motion & Accessibility
- Zero motion on page load (no entrance fade-ups, no staggered staggerings).
- Motion only answers direct user manipulation:
  - Bottom sheet sliding up on open (`cubic-bezier(0.16, 1, 0.3, 1)`, 220ms).
  - Before/after slider handle following pointer/touch or left/right arrow keystroke.
- Full respect for `@media (prefers-reduced-motion: reduce)`.
- Minimum tap target: `44px x 44px`.
- High contrast: Text meets WCAG AA (contrast ratio $> 4.5:1$).

---

## 3. Signature Elements

### 3.1 `BeforeAfterSlider`
- Interactive comparison between original issue photo and officer resolution proof photo.
- Supports pointer drag, touch swipe, and keyboard controls (ArrowLeft, ArrowRight, Home, End).
- Large high-contrast yellow handle (`#F2B705`) with split directional indicator.
- Explicit text badges: "Before" (top-left) and "After fix" (top-right).
- Captions beneath each image stating the timestamp and role of the submitter.

### 3.2 `Timeline` (Road Centerline Motif)
- Represents complaint lifecycle as a vertical Bengaluru road centerline:
  - Completed events connected by a solid 3px asphalt/marking line.
  - Pending future events indicated by a dashed line.
- Each milestone node displays:
  - Shape-coded badge (circle for filed, diamond for in-progress, square for resolved, shield for verified/auto-closed).
  - Plain language actor attribution: "Citizen", "Ward Officer", "Municipal Admin".
  - Timestamp in clean relative/absolute format.
  - Exact remarks from `statusHistory` in plain language.

### 3.3 `StatusBadge` (Plate Motif)
- 2px radius plate with three simultaneous indicators:
  1. Shape-coded icon (Square, Triangle, Check, Refresh, Clock).
  2. Distinct text label.
  3. High-contrast border and background color pairing.
  - Never relies on color alone (accessible to all vision deficiencies).

### 3.4 `ComplaintRow` (Flat List Row)
- Not an elevated card with soft shadows.
- A functional 1px-divided row showing:
  - 56x56 thumbnail with rounded 4px corners.
  - Title in bold left-aligned Archivo.
  - Address and distance (e.g. "27th Main Rd • 18 m away").
  - StatusBadge plate.
  - Support/Upvote button with live counter.

---

## 4. ASCII Wireframes (390px Mobile Viewport)

### 4.1 `/report` (Three-Step Bottom Sheet)
```text
+---------------------------------------+
| [X] Report a problem           Step 1 |
+---------------------------------------+
| Take or choose a photo of the issue   |
|                                       |
| +-----------------------------------+ |
| |                                   | |
| |        [ Camera Shutter ]         | |
| |       Tap to take live photo      | |
| |                                   | |
| +-----------------------------------+ |
|                                       |
| [*] Live outdoor camera recommended   |
|                                       |
| [ Next: Confirm location          > ] |
+---------------------------------------+

(Step 2: Confirm Location & Proximity)
+---------------------------------------+
| [<] Location & duplicates      Step 2 |
+---------------------------------------+
| Pinpoint on 27th Main Rd, HSR Layout  |
| Accuracy: ±6 m (Open sky confirmed)   |
|                                       |
| +-----------------------------------+ |
| | [ Map View ]                      | |
| |         (o) Your position         | |
| +-----------------------------------+ |
|                                       |
| Matching reports nearby:              |
| +-----------------------------------+ |
| | [Img] Broken drain cover          | |
| |       27th Main Rd • 12 m away    | |
| |       [Open]  [Support this report] |
| +-----------------------------------+ |
|                                       |
| [ My problem is different         > ] |
+---------------------------------------+

(Step 3: Category & Description)
+---------------------------------------+
| [<] Details                    Step 3 |
+---------------------------------------+
| Category                              |
| [ Roads ] [ Sanitation ] [ Lights ]   |
| [ Water & Drainage ] [ Others ]       |
|                                       |
| Problem description                   |
| +-----------------------------------+ |
| | e.g. Open manhole on footpath     | |
| | opposite bank...                  | |
| +-----------------------------------+ |
|                                       |
| [ Submit report                     ] |
+---------------------------------------+
```

### 4.2 `/complaints/[id]` (Detail View)
```text
+---------------------------------------+
| [< Back]  Complaint #150-042    [Share]|
+---------------------------------------+
| [Pending Verification]  Roads         |
| Open drain cover on 27th Main         |
| 27th Main Rd, Sector 1, HSR Layout    |
| Ward 174 • BBMP-Roads                 |
+---------------------------------------+
| BEFORE AND AFTER FIX                  |
| +-----------------------------------+ |
| | [Before]            | [After fix] | |
| |                     |             | |
| |                     [==#==]       | |
| |                     |             | |
| +-----------------------------------+ |
| Reported: 10 Nov       Fixed: 12 Nov  |
| by Citizen Rahul       by Insp. Sunita|
+---------------------------------------+
| CITIZEN AUDIT (3 days remaining)      |
| Does this fix resolve the issue?      |
| [ Yes, it's fixed ]  [ Not fixed ]    |
+---------------------------------------+
| TIMELINE OF ACTIONS                   |
|                                       |
| (*) 12 Nov, 14:30 • Officer Sunita    |
|  |  Resolved on-site. New RCC slab    |
|  |  placed and sealed. (GPS: ±8 m)    |
|  |                                    |
| (*) 11 Nov, 09:15 • Officer Sunita    |
|  |  Inspection completed. Concrete    |
|  |  slab ordered from BBMP depot.    |
|  |                                    |
| (o) 10 Nov, 16:20 • Citizen Rahul     |
|     Report filed with photo.          |
+---------------------------------------+
```

---

## 5. Review Against "Tells" to Avoid

| Tell to Avoid | Plan Evaluation | Revision Made & Reason |
| :--- | :--- | :--- |
| **1. Cream background with a serif and a terracotta accent** | Our initial kerb token could drift towards warm cream if not carefully audited. | **Revision:** Locked `color-kerb` to neutral concrete gray `#F2F4F3` (RGB 242, 244, 243) and body typeface strictly to `Noto Sans` (sans-serif) to evoke street concrete rather than editorial cream paper. |
| **2. Near-black background with one neon accent** | None present. | **Confirmed:** Strict light mode only. Background is light kerb (`#F2F4F3`) with dark asphalt text (`#23272B`). |
| **3. Purple/blue gradients, glassmorphism, gradient washes, glow** | None present. | **Confirmed:** Replaced default gradient body in `globals.css` with flat `#F2F4F3`. No `backdrop-blur` on content cards; opaque solid surfaces with 1px border. |
| **4. Centred hero with a tagline and three feature cards** | Many web templates force a centered marketing hero on homepages. | **Revision:** Top navigation and pages jump straight into active tools (map, filter chips, list rows). No marketing slogans or 3-card marketing features. |
| **5. Every piece of content in identical rounded cards with soft shadow** | Easy trap to put complaints into floating rounded cards. | **Revision:** Replaced card containers with flat, 1px-divided `ComplaintRow` items on a white plate. Shadows removed entirely except for floating sheets and drag handles. |
| **6. All-caps tracked-out labels above headings** | Common trope (`STATUS`, `DETAILS`). | **Revision:** Strictly enforced sentence case everywhere ("Problem details", "Status history", "Before and after fix"). No uppercase letter-spacing hacks. |
| **7. "01 / 02 / 03" numbering where nothing is a real sequence** | Arbitrary sequential styling. | **Revision:** Numbers used strictly for actual step progression in `/report` ("Step 1 of 3") and real counts (upvotes, meters, hours). Never for decorative list items. |
| **8. Middle-dot meta strings (A · B · C), "→" on every link, emoji as icons** | Easy to lazily use `·` and `→`. | **Revision:** Replaced middle-dot separators with structured whitespace, discrete 2px badges, or plain bullet points. Removed trailing arrows on action buttons. Zero emoji used as icons; Lucide SVG icons used with semantic labels. |
| **9. Fade-up animation on every section, hover-lift on every card** | Creates sluggish, generic template feel. | **Revision:** Zero motion on initial page loads. No hover-lift transforms. CSS transitions reserved solely for direct user touch gestures (dragging slider, opening bottom sheet). |
| **10. Stock illustrations, lorem ipsum, "Welcome to...", "Seamless", "Empower"** | Marketing jargon and cartoon vector graphics. | **Revision:** Copy uses direct civic terminology ("Report a problem", "Support this report", "Yes, it's fixed"). Zero stock illustrations or abstract vector art; real Bengaluru ward context. |
| **11. An icon on every label and button** | Visual clutter from icon overloading. | **Revision:** Removed decorative icons from standard buttons. Icons kept only where functional: camera shutter, search field, and StatusBadge shape-codes. |

---

## 6. Visual Implementation & Squint-Test Critique (Stages 1–3)

### 6.1 Squint-Test Analysis
- **One Memorable Anchor:** On squinting at the `/complaints/[id]` view, the Before/After comparison box with its bold `#F2B705` marking yellow drag handle and high-contrast divider is immediately recognizable as the dominant element. The eye travels directly to the resolution proof first.
- **Natural Hierarchy:** 
  1. Top plate: StatusBadge (shape-coded) + Category + Bold Archivo Title + Address.
  2. Before/After slider: Physical comparison of problem vs. resolution.
  3. Action plate: Citizen Audit window (clear 4-day countdown with distinct "Yes, it's fixed" and "Not fixed" choices).
  4. Engagement: Community Priority support button.
  5. Audit Trail: Road centerline timeline with solid past history, GPS accuracy metrics, and dashed future verification projection.
- **Calm Infrastructure Feel:** The flat asphalt (`#23272B`) and kerb (`#F2F4F3`) surfaces with 1px border dividers provide high legibility in daylight without visual fatigue or generic SaaS card bloat.

### 6.2 Screenshot Verification Artifacts
All screen sizes verified and saved in `docs/screenshots/`:
- `report-390px.png` & `report-1280px.png`: 3-step report sheet with camera shutter, GPS accuracy readout, mini-map, and inline duplicate warning.
- `complaint-390px.png` & `complaint-1280px.png`: Full detail view with Before/After slider, citizen audit action, and road timeline.
- `components-390px.png` & `components-1280px.png`: Complete token swatch palette, status badges, complaint rows, buttons, and switches.

