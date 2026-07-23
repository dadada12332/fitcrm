# Design QA: Onboarding Registration Shell

## Evidence

- Source screen before change: `/var/folders/lb/xkrtj8910d98wdwc_pflc1s80000gn/T/TemporaryItems/NSIRD_screencaptureui_dhc7ky/Снимок экрана 2026-07-23 в 14.43.41.png`
- Desktop implementation: `/Users/amiran/fitcrm/artifacts/onboarding-cloud-glass/onboarding-registration-shell-desktop.png`
- Mobile implementation: `/Users/amiran/fitcrm/artifacts/onboarding-cloud-glass/onboarding-registration-shell-mobile.png`
- Side-by-side comparison: `/Users/amiran/fitcrm/artifacts/onboarding-cloud-glass/design-qa-before-after.png`
- Desktop QA viewport: `1280 × 720` CSS px.
- Mobile QA viewport: `390 × 844` CSS px.

## Comparison

- Onboarding now uses the same full-viewport cloud image, drift animation and `50 / 50` split as registration.
- The left carousel reuses registration's translucent `bg-foreground/45` layer instead of a separate solid black shell.
- The right side uses the exact registration glass material: identical margin, radius, translucent fill, ring, shadow, blur, brightness and saturation.
- Onboarding inputs were changed from opaque surfaces to the same translucent field treatment used by registration.
- The primary navigation button now spans the same width as the inputs, while the step circles, icons, status copy, heading, labels and fields are larger and easier to scan.
- The four-step onboarding logic, forms and Server Actions remain unchanged.

## Runtime Checks

- Authenticated step 1 rendered at desktop and mobile viewports.
- Desktop preserves the full left story while all right-side controls remain visible without page scrolling.
- Mobile hides the branding carousel and keeps the enlarged stepper, form fields and full-width navigation button usable inside the fixed cloud shell.
- No onboarding step was submitted during visual QA, so the test account remains at step 1.

final result: passed

# Design QA: Auth Feature Grid Under Copy

## Evidence

- Visual reference: `/var/folders/lb/xkrtj8910d98wdwc_pflc1s80000gn/T/TemporaryItems/NSIRD_screencaptureui_l2Ofii/Снимок экрана 2026-07-23 в 14.12.57.png`
- Registration implementation: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/auth-feature-grid-reviews.png`
- Side-by-side comparison: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/design-qa-feature-grid-reference.png`
- Desktop viewport: `1280 × 720` CSS px.

## Comparison

- Four feature blocks now sit immediately below the active carousel description.
- The desktop half-screen uses a compact `2 × 2` grid instead of the reference's full-width row, preserving readable card width without introducing horizontal clipping.
- Cards retain the reference's dark translucent surface, soft border, colorful icon tile, title and supporting copy.
- Card height, internal padding, icons and both text levels were increased after the first pass to match the visual weight of the reference more closely.
- Existing testimonials remain below the feature grid as one compact review per scene, so the previous social-proof direction is preserved without overflowing the viewport.
- Copy, feature cards and testimonial enter in a staggered sequence when the carousel changes.

## Runtime Checks

- Registration rendered at `1280 × 720`.
- Heading, all four feature cards, testimonial, carousel controls and registration form remain visible without page scrolling or clipping.
- Browser console only reported the known extension-injected `aria-autocomplete` hydration attribute; no application error was introduced.

final result: passed

# Design QA: Auth Copy-First Review Carousel

## Evidence

- Same-viewport source before change: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/auth-crm-widgets-analytics.png`
- Analytics review scene: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/auth-review-layout-analytics.png`
- Team review scene: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/auth-review-layout-team.png`
- Side-by-side comparison: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/design-qa-review-layout-before-after.png`
- Desktop viewport: `1280 × 720` CSS px.

## Comparison

- All floating CRM widgets were removed from the left panel.
- The category, heading and supporting copy now begin directly below the logo, creating a clear top-down reading order.
- Two large testimonial-style cards sit beneath the copy with star ratings, short quotes, role/location context and restrained avatar initials.
- Cards use slightly offset widths and rotation to preserve the airy quality without recreating the former widget clutter.
- Each carousel scene changes both the product story and its paired reviews.
- Copy and review cards transition independently with blur, directional movement and stagger; manual navigation still resets the auto-rotation timeout.

## Runtime Checks

- Analytics and team review scenes rendered at `1280 × 720`.
- Cards remain inside the left viewport without clipping.
- Registration controls and right glass panel retain their previous geometry.

final result: passed

# Design QA: Extra-Wide Auth Form

## Evidence

- Same-viewport source before change: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/auth-crm-widgets-analytics.png`
- Registration desktop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/auth-form-extra-wide.png`
- Registration mobile: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/auth-form-extra-wide-mobile.png`
- Side-by-side comparison: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/design-qa-extra-wide-auth-form.png`
- Desktop viewport: `1280 × 720` CSS px.
- Mobile viewport: `390 × 844` CSS px.

## Comparison

- Registration, confirmation and login containers increased from `480px` to `520px`.
- Responsive horizontal padding changed from a fixed `64px` to `24px / 40px / 48px`, so the controls actually gain width at both desktop and mobile sizes.
- Inputs, primary action, divider and Google action preserve one shared width and alignment.
- Safe spacing remains between controls and the rounded glass edge.

## Runtime Checks

- Registration rendered at `1280 × 720` and `390 × 844`.
- No clipped labels, controls or horizontal overflow in the inspected states.
- React review found no new hook, state, accessibility or TypeScript issues.

final result: passed

# Design QA: Auth CRM Widget Scenes and Rebuild Transition

## Evidence

- Same-viewport source before change: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-smoky-glass-wider-controls.png`
- Analytics scene: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/auth-crm-widgets-analytics.png`
- Operations scene: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/auth-crm-widgets-operations.png`
- Mobile registration: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/auth-crm-widgets-mobile.png`
- Side-by-side comparison: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/design-qa-crm-widget-scenes-before-after.png`
- Desktop viewport: `1280 × 720` CSS px at device scale factor `1`.
- Mobile viewport: `390 × 844` CSS px.

## Comparison

- Repetitive pill-only layouts were replaced with three distinct CRM scenes.
- Analytics now combines revenue and attendance KPI cards, a seven-day mini chart and a risk badge.
- Operations now uses a schedule card, client check-in, renewal list and payment event.
- Team now uses a compact staff roster, shift metric, task progress and permissions status.
- The horizontal strip translation was removed. Old widgets now disperse with blur, scale and directional movement while new widgets assemble with a staggered entrance.
- Copy transitions independently with vertical movement and blur; the active pager width follows with a spring.
- Auto-rotation was slowed from `3.5s` to `5.2s`, allowing each scene to be read before it changes.
- Manual navigation resets the auto-rotation timeout, preventing a second unexpected transition immediately after a user selection.

## Runtime Checks

- Analytics and operations scenes rendered at `1280 × 720`.
- Automatic rotation completed without shifting or scrolling the viewport.
- The auth surface remains internally scrollable on mobile while the page is fixed to the viewport.
- TypeScript discriminated unions cover every widget renderer.

## Comparison History

- Pass 1: P2 — widgets varied in content but the page could shift when an automated browser interaction scrolled the pager into view.
- Fix: constrained the auth layout to a fixed viewport and kept overflow inside the auth surface.
- Pass 2: all stable scenes fit the desktop viewport; no remaining P0, P1 or P2 findings.

final result: passed

# Design QA: Wider Auth Controls

## Evidence

- Same-viewport source before change: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-smoky-transparent-glass-desktop.png`
- Registration desktop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-smoky-glass-wider-controls.png`
- Side-by-side comparison: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/design-qa-wider-auth-controls.png`
- Desktop viewport: `1280 × 720` CSS px at device scale factor `1`.

## Comparison

- Registration and login form containers increased from `440px` to `480px`.
- Inputs, primary action and Google action expand together and keep the same alignment.
- The change remains capped by the available container width, so narrow and mobile layouts retain their existing responsive behavior.

## Runtime Checks

- Registration rendered at `1280 × 720`.
- No clipping or horizontal overflow in the inspected desktop state.

final result: passed

# Design QA: Smoky Transparent Auth Glass

## Evidence

- Same-viewport source before change: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-darker-glass-balanced-inputs-stable.png`
- Registration desktop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-smoky-transparent-glass-desktop.png`
- Registration mobile: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-smoky-transparent-glass-mobile.png`
- Login desktop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/login-smoky-transparent-glass-desktop.png`
- Side-by-side comparison: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/design-qa-smoky-glass-before-after.png`
- Desktop viewport: `1280 × 720` CSS px at device scale factor `1`.
- Mobile viewport: `390 × 844` CSS px at device scale factor `1`.

## Comparison

- The former bright `bg-muted/85` surface was replaced with a dark-context `bg-background/25` glass layer.
- Backdrop brightness is restrained to `90%` and saturation to `75%`, reducing the vivid blue cast without hiding the cloud image.
- Foreground tokens switch locally to their dark-theme values, preserving legible white form text over the transparent surface.
- Inputs and secondary actions remain translucent and visually integrated with the panel.
- Registration and login use the same material treatment at desktop and mobile breakpoints.

## Runtime Checks

- Registration rendered at `1280 × 720` and `390 × 844`.
- Login rendered at `1280 × 720`.
- No text clipping or horizontal overflow in the inspected states.
- Registration controls and login actions remain present and readable.

## Comparison History

- Pass 1: P2 — a light neutral fill remained too opaque and visually bright.
- Fix 1: introduced a dark translucent context with reduced backdrop brightness and saturation.
- Pass 2: P2 — the first dark pass obscured more of the cloud texture than intended.
- Fix 2: reduced the dark fill from `35%` to `25%` and raised backdrop brightness from `75%` to `90%`.
- Pass 3: smoky glass is visibly transparent, restrained in color and readable; no remaining P0, P1 or P2 findings.

final result: passed

# Design QA: Darker Auth Glass and Balanced Inputs

## Evidence

- Same-viewport source before change: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-wide-left-heading-desktop.png`
- Registration desktop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-darker-glass-balanced-inputs-stable.png`
- Registration mobile: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-darker-glass-balanced-inputs-mobile.png`
- Side-by-side comparison: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/design-qa-contrast-before-after.png`
- Desktop viewport: `1280 × 720` CSS px at device scale factor `1`.
- Mobile viewport: `390 × 844` CSS px at device scale factor `1`.
- State: empty registration form, light theme, first carousel slide.

## Comparison

- The right glass surface now uses the darker neutral `bg-muted/85`, increasing separation from the cloud background.
- The account link increased from `text-xs` to `text-sm` and uses full foreground contrast.
- Supporting copy, terms and divider labels moved to stronger foreground opacity levels.
- Inputs changed from opaque-looking white surfaces with shadows to `bg-background/30`, a subtle foreground border and no shadow, so they visually belong to the glass panel.
- Login received the same contrast and input treatment.

## Runtime Checks

- Registration rendered at `1280 × 720` and `390 × 844`.
- No text clipping or horizontal overflow in the inspected desktop and mobile states.
- In-app browser DOM snapshot contains all labels, controls and actions.

## Comparison History

- Pass 1: P2 — darker panel and stronger copy improved readability, but fields still looked too white and detached.
- Fix: reduced input fill opacity, removed field shadows and strengthened secondary text.
- Pass 2: controls sit inside the glass hierarchy without losing boundaries or focus visibility; no remaining P0, P1 or P2 findings.

final result: passed

# Design QA: Wider Left-Aligned Auth Form

## Evidence

- Same-viewport source before change: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-half-glass-reduced-blur-desktop.png`
- Registration desktop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-wide-left-heading-desktop.png`
- Login desktop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/login-wide-left-heading-desktop.png`
- Desktop viewport: `1440 × 960` CSS px at device scale factor `1`.
- Registration mobile: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-wide-left-heading-mobile.png`
- Mobile viewport: `390 × 844` CSS px at device scale factor `1`.
- Side-by-side comparison: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/design-qa-wide-left-heading.png`
- Normalization: before and after registration captures were each resized to `720 × 480` and placed side by side.
- State: empty registration and login forms, light theme, first carousel slide.

## Comparison

- Registration and login headings increased from `text-2xl` to `text-3xl`.
- Headings and supporting copy are now left-aligned and use a stronger, more editorial hierarchy.
- Form width increased from `384px` to `440px`, lengthening all inputs and actions consistently.
- Backdrop blur decreased from `lg` to `md`, making the cloud shapes more visible through the glass.
- Mobile keeps the left alignment; the larger registration heading wraps intentionally without horizontal clipping.

## Runtime Checks

- Registration and login rendered at `1440 × 960`.
- Registration rendered at `390 × 844` with no horizontal or vertical viewport overflow.
- In-app browser console: no warnings or errors.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.

## Comparison History

- Pass 1: P2 — form typography was small and centered, inputs felt narrow, and the background remained too softened.
- Fix: increased and left-aligned the heading block, widened the form container, and reduced blur one additional step.
- Pass 2: hierarchy, alignment and field length match the requested direction; no remaining P0, P1 or P2 findings.

final result: passed

# Design QA: Reduced Auth Glass Blur

## Evidence

- Same-viewport source before change: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-half-glass-desktop.png`
- Implementation desktop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-half-glass-reduced-blur-desktop.png`
- Desktop viewport: `1440 × 960` CSS px at device scale factor `1`.
- Implementation mobile: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-half-glass-reduced-blur-mobile.png`
- Mobile viewport: `390 × 844` CSS px at device scale factor `1`.
- Side-by-side comparison: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/design-qa-reduced-glass-blur.png`
- Normalization: before and after desktop captures were each resized to `720 × 480` and placed side by side.
- State: `/register`, light theme, empty form, first carousel slide.

## Comparison

- Backdrop blur was reduced from `xl` to `lg`; opacity, geometry and saturation remain unchanged.
- Cloud contours are slightly more legible through the glass, especially near the upper and lower edges.
- Form labels, inputs, links and disabled primary action preserve their previous contrast.

## Runtime Checks

- No horizontal or vertical viewport overflow at `1440 × 960` or `390 × 844`.
- In-app browser console: no warnings or errors.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.

## Comparison History

- Pass 1: P2 — cloud shapes were too softened behind the glass.
- Fix: reduced backdrop blur by one design-system step without changing surface opacity.
- Pass 2: clouds are visible but restrained; no remaining P0, P1 or P2 findings.

final result: passed

# Design QA: Half-Screen Glass Auth Panel

## Evidence

- User reference: `/var/folders/lb/xkrtj8910d98wdwc_pflc1s80000gn/T/TemporaryItems/NSIRD_screencaptureui_HKQLXk/Снимок экрана 2026-07-23 в 12.21.59.png`
- Reference pixels: `1534 × 2048`; CSS viewport and device density are unavailable.
- Same-viewport source before change: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-matching-clouds-desktop.png`
- Implementation desktop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-half-glass-desktop.png`
- Desktop viewport: `1440 × 960` CSS px at device scale factor `1`.
- Implementation laptop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-half-glass-laptop.png`
- Laptop viewport: `1280 × 720` CSS px at device scale factor `1`.
- Implementation mobile: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-half-glass-mobile.png`
- Mobile viewport: `390 × 844` CSS px at device scale factor `1`.
- Side-by-side comparison: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/design-qa-half-glass.png`
- Normalization: before and after desktop captures were each resized to `720 × 480` and placed side by side in a `1440 × 480` comparison.
- State: `/register`, light theme, empty form, first carousel slide.

## Comparison

- Geometry: desktop is split into two exact `50%` halves.
- Insets: the right glass surface uses the same `20px` desktop inset at the top, right and bottom.
- Surface: `bg-background/50`, `backdrop-blur-xl` and `backdrop-saturate-150` allow the shared cloud asset to remain visible through the form panel.
- Separation: a token-based ring and soft foreground shadow define the rounded glass edge without introducing an opaque card.
- Responsive behavior: mobile uses an equal `12px` inset on all sides while preserving the full registration flow.

## Runtime Checks

- No horizontal or vertical viewport overflow at `1440 × 960`, `1280 × 720` or `390 × 844`.
- Registration fields, terms and Google action remain visible at laptop and mobile sizes.
- In-app browser console: no warnings or errors.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.

## Comparison History

- Pass 1: P2 — the form surface was too opaque and capped at `600px`, so its right inset did not consistently match the vertical insets.
- Fix: changed the desktop split to exact halves, removed the width cap, applied equal insets, and increased glass transparency with backdrop blur.
- Pass 2: geometry and glass treatment match the requested direction; no remaining P0, P1 or P2 findings.

final result: passed

# Design QA: Matching Auth Cloud Backgrounds

## Evidence

- Source before change: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-airy-badges-desktop-final.png`
- Source viewport: `1440 × 960` CSS px at device scale factor `1`.
- Implementation desktop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-matching-clouds-desktop.png`
- Desktop viewport: `1440 × 960` CSS px at device scale factor `1`.
- Implementation laptop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-matching-clouds-laptop.png`
- Laptop viewport: `1280 × 720` CSS px at device scale factor `1`.
- Implementation mobile: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-matching-clouds-mobile.png`
- Mobile viewport: `390 × 844` CSS px at device scale factor `1`.
- Side-by-side comparison: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/design-qa-matching-clouds.png`
- Normalization: before and after desktop captures were each resized to `720 × 480` and placed side by side in a `1440 × 480` comparison.
- State: `/register`, light theme, empty form, first carousel slide.

## Comparison

- Full view: the cloud asset now spans the complete auth viewport instead of ending at the left/right split.
- Background treatment: both sides use the same image, animation and `bg-foreground/45` overlay. There is no separate light-cloud treatment on the right.
- Form surface: the form sits on a centered, translucent `bg-background/90` surface so labels, inputs and links preserve their original contrast over the shared dark clouds.
- Spacing: the surface exposes the cloud background around all four sides at desktop, laptop and mobile widths.
- Motion: one shared `clouds-anim` layer prevents drift or timing differences at the panel boundary.
- Colors and effects: existing theme tokens are used for the overlay, surface, ring, shadow and backdrop blur.

## Runtime Checks

- No horizontal or vertical viewport overflow at `1440 × 960`, `1280 × 720` or `390 × 844`.
- Registration fields and actions remain visible at `1280 × 720`.
- Mobile keeps the same cloud treatment and the form remains readable inside the inset surface.
- In-app browser console: no warnings or errors.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.

## Comparison History

- Pass 1: P2 — a light overlay on the right made the two cloud treatments visibly different.
- Fix: moved the image and animation to one full-screen layer, applied the same foreground overlay to both panels, and introduced a separate readable form surface.
- Pass 2: shared cloud treatment is visually continuous; no remaining P0, P1 or P2 findings.

final result: passed

# Design QA: Auth Airy CRM Badges — Option 3

## Evidence

- Selected design: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/selected-airy-badges-option-3.png`
- Selected design pixels: `1536 × 1024`; CSS viewport and device density are unavailable because the source is an ImageGen concept.
- Implementation desktop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-airy-badges-desktop-final.png`
- Desktop viewport: `1440 × 960` CSS px at device scale factor `1`.
- Implementation laptop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-airy-badges-laptop-final.png`
- Laptop viewport: `1280 × 720` CSS px at device scale factor `1`.
- Implementation mobile: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-airy-badges-mobile-final.png`
- Mobile viewport: `390 × 844` CSS px at device scale factor `1`.
- Side-by-side comparison: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/design-qa-airy-badges.png`
- Normalization: source and desktop implementation were each resized to `720 × 480` and placed side by side in a `1440 × 480` comparison.
- State: `/register`, light theme, empty form, first carousel slide.

## Comparison

- Full view: the left panel now uses five white pill widgets and one compact status cluster over the landing cloud asset, while the registration form remains unchanged.
- Focused region: the full left auth panel is the relevant comparison region; no additional crop was needed.
- Typography: widget labels use the CRM font, medium weight and native icon sizing; the lower marketing heading and description were increased to match the selected option's hierarchy.
- Spacing: badges retain a loose diagonal composition, never cover the lower copy, and fit at both `1440 × 960` and `1280 × 720`.
- Colors: all surfaces, text, rings, shadows and semantic icon tones use existing design-system tokens.
- Motion: every widget has a slow independent vertical drift; `prefers-reduced-motion` disables badge and cloud animation.
- Copy: the first slide matches the selected option. The other two carousel slides use CRM-specific settings and staff data in the same visual language.

## Five-Surface Review

- Background: existing landing cloud asset with the approved token overlay.
- Primary surfaces: CRM-style white pill badges with subtle ring and shadow.
- Secondary surface: compact overlapping status dots inside a white pill.
- Content surface: bottom-aligned carousel badge, title and description.
- Action surface: the registration form and carousel dots remain unchanged and accessible.

## Runtime Checks

- Carousel controls 2 and 3 changed the headings to “Полный контроль над клубом” and “Управление сотрудниками”.
- No horizontal or vertical overflow at `1280 × 720`; no overflow at `390 × 844`.
- The branding panel remains hidden on mobile, preserving the existing registration form.
- In-app browser console: no warnings or errors.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.

## Comparison History

- Pass 1: P2 — badges and lower marketing copy were visibly smaller than the selected concept.
- Fix: increased pill padding, label and icon sizes, then strengthened the title and description hierarchy.
- Pass 2: stable diagonal composition at desktop and laptop widths; no remaining P0, P1 or P2 findings.

final result: passed

# Design QA: Auth Carousel Screen Fit

## Evidence

- Source visual truth: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-desktop-final.png`
- Source pixels and viewport: `1440 × 960` at device scale factor `1`.
- Implementation desktop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-carousel-fit-desktop.png`
- Implementation desktop pixels and viewport: `1440 × 960` at device scale factor `1`.
- Implementation laptop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-carousel-fit-laptop.png`
- Implementation laptop pixels and viewport: `1280 × 720` at device scale factor `1`.
- Combined before/after comparison: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/design-qa-carousel-fit.png`
- Normalization: both desktop captures resized from `1440 × 960` to `720 × 480` and placed side by side in a `1440 × 480` comparison.
- State: `/register`, light theme, empty form, dashboard carousel slide.

## Comparison

- Full view: the source used `object-cover`, which cropped the right side and bottom of each CRM screenshot. The implementation shows the complete CRM viewport inside the same carousel region.
- Focused region: the full left panel is the relevant focused region; the complete before/after is readable in the combined comparison, so no additional detail crop was required.
- Typography: unchanged.
- Spacing: the screen now sits within a padded glass frame. Caption and controls remain aligned, and the layout has no vertical or horizontal overflow at `1440 × 960` or `1280 × 720`.
- Colors: only existing design-system opacity utilities are used (`bg-background/10`, `border-background/20`).
- Image quality: source PNGs retain their native aspect ratios through `object-contain`; no stretching, cropping, or generated replacement assets.
- Copy: unchanged.

## Findings

- The original P2 cropping problem is resolved.
- No actionable P0, P1, or P2 findings remain.

## Runtime Checks

- All three carousel dots were exercised.
- Settings and staff screenshots both rendered at `539.28 × 313.64` inside a `581.99 × 337.65` slide host at `1280 × 720`, confirming full containment.
- In-app browser console: no warnings or errors.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.

## Comparison History

- Pass 1 before fix: P2 — `object-cover` cropped product content and hid the right side of the CRM screens.
- Fix: switched each slide to a centered, padded `object-contain` presentation, added a subtle glass surface, and removed the content-obscuring bottom gradient.
- Pass 2 after fix: all screenshots fit at desktop and laptop viewports; no P0/P1/P2 findings.

final result: passed

# Design QA: Telegram KPI

## Target

- User screenshot: legacy Telegram KPI cards with centered colored values.
- CRM reference pattern: `ClientsStats`, `MembershipsStats`, `ScheduleKPIs`, payments KPI.
- Expected result: one segmented KPI surface with neutral icons, left-aligned labels and values, responsive 2/4-column layout.

## Captures Reviewed

- Desktop: `/integrations/telegram`, connected QA state, 1280x720.
- Mobile: `/integrations/telegram`, connected QA state, 390x844.
- Mobile statistics tab: 390x844.

## Findings

- KPI typography, borders, spacing, icon treatment and colors match the established CRM pattern.
- Desktop renders four equal segments without independent floating cards.
- Mobile renders a stable 2x2 grid; labels wrap without clipping and values remain aligned.
- Light theme uses only design-system tokens. No raw colors or decorative styling added.
- Statistics tab reuses the same component and no longer nests muted cards inside a card.

## Result

final result: passed

# Design QA: Auth Cloud Background

## Evidence

- Source visual truth: `/var/folders/lb/xkrtj8910d98wdwc_pflc1s80000gn/T/TemporaryItems/NSIRD_screencaptureui_BBYG12/Снимок экрана 2026-07-23 в 11.03.17.png`
- Source pixels: `1914 × 2218`; source CSS viewport and device density are unavailable.
- Implementation desktop: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-desktop-final.png`
- Implementation mobile: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/register-mobile-final.png`
- Desktop viewport: `1440 × 960` CSS px at device scale factor `1`; screenshot `1440 × 960`.
- Mobile viewport: `390 × 844` CSS px at device scale factor `1`; screenshot `390 × 844`.
- Combined comparison: `/Users/amiran/fitcrm/artifacts/auth-cloud-background/design-qa-comparison.png`
- Normalization: source resized/cropped to `720 × 960`; implementation cropped to the left `720 × 960` auth panel; both placed in one `1440 × 960` comparison.
- State: `/register`, light theme, empty form. The source and implementation show different timed carousel slides; the requested comparison target is the panel background.

## Comparison

- Full view: auth proportions, screenshot frame, logo, caption hierarchy, and controls remain unchanged. The black surface is intentionally replaced by the exact `/screens/clouds.jpg` landing asset with the existing `clouds-anim` motion and a token-based foreground overlay.
- Focused region: not needed because the complete requested change is the full `720 × 960` left panel already visible in the combined comparison.
- Typography: unchanged and legible over the new background.
- Spacing: unchanged; desktop split is stable and the branding panel remains hidden on mobile.
- Colors: overlay uses `bg-foreground/45`; no raw color was introduced.
- Image quality: native `2600 × 1950` landing asset rendered through `next/image`; no gaps, stretching, or softness at the tested viewport.
- Copy: unchanged.

## Findings

- No actionable P0, P1, or P2 visual differences remain.
- The source/implementation slide difference is expected carousel timing, not design drift.

## Runtime Checks

- Carousel dot 2 changed the heading to “Полный контроль над клубом”.
- In-app browser console: no warnings or errors.
- Chrome was used for final screenshots because the in-app screenshot surface cropped the desktop split. Chrome's password-manager extension injected `aria-autocomplete` and produced an extension-only hydration warning that did not reproduce in the clean in-app browser.
- No horizontal overflow at `1440 × 960` or `390 × 844`.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.

## Comparison History

- Pass 1: no actionable P0/P1/P2 findings; no follow-up visual fix required.

final result: passed

# Design QA: Landing Pricing

> Superseded on 2026-07-22: the owner requested a full rollback to the pre-redesign pricing section from `94845ad`.

## Target

- Make pricing easier to scan while keeping plan data controlled by Platform Admin.
- Turn Standard into the clear recommended choice through value, proof and action hierarchy.
- Preserve the restrained light landing style and responsive behavior.

## Captures Reviewed

- Before: production `/#pricing`, 1440x1000.
- After: local `/#pricing`, 1440x1000 and 390x844.
- Interaction: monthly/yearly billing, four registration CTAs, Russian and Uzbek.

## Findings

- The corner ribbon was replaced with a compact recommendation badge and a clear value proposition.
- Standard now has a focused blue CTA, proof block and stable visual emphasis without changing database pricing.
- Plan names and conversion copy are localized instead of mixing English names into Russian and Uzbek pages.
- All cards remain readable in a 4-column desktop grid and a single-column mobile flow.
- The pricing container expands to 1760px; laptop widths use a 2×2 grid instead of compressing four narrow columns.
- No horizontal overflow was found at 390px; billing controls and long Uzbek copy fit correctly.

## Result

final result: passed

# Design QA: Reports Attention

## Target

- Replace equal-weight floating alert cards with one quiet operational surface.
- Preserve direct navigation while separating actionable problems from attendance context.

## Captures Reviewed

- Desktop: `/reports`, authorized QA club, 1280x720.
- Mobile: `/reports`, authorized QA club, 390x844.
- Interaction: at-risk client row to the clients report.

## Findings

- Priority rows use CRM tokens and consistent 8px surfaces without raw colors.
- Resolved rows are visibly calm and disabled; active rows remain obvious and actionable.
- Attendance is a separate segment and no longer competes with urgent tasks.
- Labels and descriptions wrap correctly on mobile without horizontal overflow.
- The alert badge matches the actual sum of expiring, at-risk and debt records.

## Result

final result: passed

# Design QA: Telegram Broadcast

## Target

- CRM reference pattern: compact bordered tools, Zinc/shadcn tokens, restrained status colors and clear primary action.
- Expected result: one coherent broadcast workflow with a readable editor, separate live preview and responsive history.

## Captures Reviewed

- Before: connected QA state at 1280x720.
- After: connected QA state at 1280x720 and 390x844.
- Mobile interaction states: scheduled send, variable popover, personalized preview and 4097/4096 limit error.

## Findings

- The previous three-column grid squeezed the composer and detached settings from the send action.
- The new two-column layout gives the composer the primary width and keeps the preview stable at 340px.
- Mobile controls stack without horizontal overflow; primary and test actions remain reachable below the editor.
- Telegram limits, attachment metadata and errors are visible before submission.
- The preview uses CRM tokens and the real bot display name while external links use the bot username.

## Result

final result: passed

# Design QA: Landing Growth OS and Retention

## Target

- Continue the existing light editorial landing style without introducing a separate visual system.
- Explain Retention and Growth OS as one product flow before the pricing section.
- Keep the product story readable and interactive on desktop and mobile.

## Captures Reviewed

- Desktop: `/\#growth-os`, 1440x1000, Russian.
- Mobile: `/\#growth-os`, 390x844, Russian and Uzbek.
- Interaction: all three retention signals and synchronized Growth OS action state.

## Findings

- The section reuses the landing's large typography, framed product surfaces and restrained blue accent.
- Retention signals, AI recommendation, next action and expected result form one clear left-to-right story on desktop.
- Mobile stacks the two product surfaces without horizontal overflow or clipped labels.
- Automatic scenario rotation pauses on hover/focus and respects reduced-motion preferences.
- The AI recommendation now exposes two concrete employee outputs: a call script and SMS copy, both readable on desktop and mobile.
- Russian, English and Uzbek dictionaries are complete and type-safe.

## Result

final result: passed
