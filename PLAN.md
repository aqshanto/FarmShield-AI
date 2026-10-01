# FarmShield AI Development Plan

## Development Philosophy

Build the application step-by-step.

Each feature must be:

1.  Designed
2.  Implemented
3.  Tested
4.  Reviewed
5.  Approved before moving forward

Never move to the next feature if the current feature is unstable.

------------------------------------------------------------------------

# Phase 0: Foundation

Tasks:

-   Setup project
-   Configure frontend/backend
-   Setup design system
-   Create documentation structure

Completion:

Application runs successfully.

------------------------------------------------------------------------

# Phase 1: Animated Design System

Goal:

Create the visual identity.

Tasks:

-   Color system
-   Typography
-   Animated components
-   Micro interactions
-   Loading animations
-   Friendly illustrations

------------------------------------------------------------------------

# Phase 2: Main Dashboard

Create:

-   Farmer overview
-   Risk cards
-   Animated statistics
-   Recommendation section

------------------------------------------------------------------------

# Phase 3: Interactive Map

Create:

-   Animated map
-   Data layers
-   Location selection
-   Smooth transitions

------------------------------------------------------------------------

# Phase 4: NASA Data Pipeline

Integrate:

-   SMAP
-   GPM
-   MODIS
-   VIIRS

Create:

-   Data fetching
-   Processing
-   Storage

------------------------------------------------------------------------

# Phase 5: Risk Intelligence Engine

Build:

-   Flood risk analysis
-   Water stress analysis
-   Crop health analysis

------------------------------------------------------------------------

# Phase 6: Farmer Experience

Build:

-   AI assistant
-   Bengali language
-   Voice support
-   Simple recommendations

------------------------------------------------------------------------

# Phase 7: Advanced Visualization

Build:

-   Historical timeline
-   Climate simulation
-   Animated storytelling

------------------------------------------------------------------------

# Phase 8: Final Polish

Tasks:

-   UI improvement
-   Performance optimization
-   Bug fixing
-   Demo preparation

------------------------------------------------------------------------

# Phase 9: Living Field View

Goal:

Show each farmer a living picture of their own field. The picture
changes with the risks, so the danger is understood without reading
numbers.

Build:

-   Animated field scene (sky, sun, clouds, soil, water, crop)
-   Crop-specific drawings: rice, wheat, potato
-   4 stages per risk, matching the risk scale:

| Risk | Safe | Watch | Warning | Danger |
|---|---|---|---|---|
| Flood (wheat, potato) | Dry field | Wet soil, puddles | Water standing between rows | Crop under water |
| Flood (rice) | Normal paddy water | Water rising | Water near plant tops | Plants under water |
| Water | Moist soil | Topsoil pale | Cracked soil, leaves curling | Deep cracks, wilting |
| Crop | Lush green | Some yellow leaves | Yellow-brown patches, spots | Many plants brown |

-   Combined "My field today" scene on the dashboard; tap a risk to focus it
-   Extra signals: heat haze, leaf spots, rain clouds, "clouds hide your field" badge
-   "Play last 2 weeks" animation from the risk trend
-   Bengali and English labels

Rules:

-   Show risk, never claim damage that was not observed.
    The danger stage says "could be damaged, act today".
-   Every stage has a text label, not color alone.
-   Respect reduced motion.
-   Later, the same scene powers the what-if simulator and the history replay (Phase 7).

------------------------------------------------------------------------

# Feature Approval Rule

After every feature Claude must confirm:

Can we move to the next feature?

Possible answers:

YES - Feature complete and stable.

NO - Issues need fixing before continuing.
