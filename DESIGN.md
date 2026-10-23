---
name: Kalandra
description: Accepted native CPU/GPU website with original sculpture and the selected offset-merge identity.
colors:
  background: "#000"
  panel: "#0d0d10"
  text: "#ededf0"
  muted: "#a5a5af"
  line: "#26262d"
  accent: "#c5b1ff"
  hero-highlight: "#c6b2ff"
  primary: "#7b4fed"
  primary-hover: "#9067f7"
  nav-primary: "#7c55e8"
  nav-primary-hover: "#916df2"
  header: "#161617"
  source: "#0b0b0e"
  source-chrome: "#111114"
  terminal: "#101013"
  section: "#08080a"
  footer: "#080809"
  docs-primary: "#95baff"
  docs-foreground: "#eeeef2"
  docs-muted-foreground: "#aaaab5"
  docs-card: "#0b0b0d"
  docs-muted: "#17171b"
  docs-accent: "#1a1a20"
  docs-border: "#292930"
typography:
  display:
    fontFamily: '"Geist Variable", sans-serif'
    fontSize: "clamp(64px, 7.3vw, 96px)"
    fontWeight: 500
    lineHeight: 1.06
    letterSpacing: "-0.035em"
  headline:
    fontFamily: '"Geist Variable", sans-serif'
    fontSize: "44px"
    fontWeight: 500
    lineHeight: 1.16
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"Geist Variable", sans-serif'
    fontSize: "21px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: '"Geist Variable", sans-serif'
    fontSize: "16px"
    lineHeight: 1.75
  action:
    fontFamily: '"Geist Variable", sans-serif'
    fontSize: "14px"
    fontWeight: 500
  source:
    fontFamily: '"Fira Code Variable", ui-monospace, monospace'
    fontSize: "13px"
    lineHeight: 1.9
    fontFeature: '"calt" 1, "liga" 1'
rounded:
  action: "30px"
  navigation-action: "28px"
  source: "12px"
  terminal: "6px"
  menu: "5px"
spacing:
  action-block: "12px"
  action-inline: "18px"
  action-gap: "18px"
  hero-action-block: "14px"
  hero-action-inline: "25px"
  source-inline: "24px"
  source-inline-mobile: "16px"
  section-gap: "70px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#fff"
    rounded: "{rounded.action}"
    typography: "{typography.action}"
    padding: "12px 18px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-hero:
    backgroundColor: "{colors.primary}"
    textColor: "#fff"
    rounded: "{rounded.action}"
    padding: "14px 25px"
  navigation-start:
    backgroundColor: "{colors.nav-primary}"
    textColor: "#fff"
    rounded: "{rounded.navigation-action}"
    padding: "10px 20px"
  source-example:
    backgroundColor: "{colors.source}"
    rounded: "{rounded.source}"
  source-option:
    backgroundColor: "transparent"
    textColor: "#a9a9b6"
    padding: "16px 0"
  brand-mark-landing:
    textColor: "#e8e8ed"
    width: "36px"
    height: "25px"
  brand-mark-docs:
    textColor: "{colors.docs-foreground}"
    width: "2rem"
    height: "1.375rem"
  terminal:
    backgroundColor: "{colors.terminal}"
    rounded: "{rounded.terminal}"
---

# Design System: Kalandra

## Overview

**Creative North Star: "One language. CPU and GPU."**

This accepted website gives a native language a direct, product-specific introduction and a rich original visual setting. Strong Geist typography and violet pill actions sit on true black; an angular violet/coral sculpture occupies the right side and extends behind the source section. The content remains practical: typed functions, explicit placement, actual native source and clear onboarding.

The user accepted this website as “awesome, acceptable for now” and selected round-four B, the offset merge, for its identity. Preserve the accepted page composition. The latest [product correction](PRODUCT.md) and [landing contract](.impeccable/surfaces/landing.md) supersede the prior serif/wire-art direction. Reference richness informs the world; the hero composition and original image are Kalandra’s own. Sources: [landing](apps/website/src/routes/+page.svelte), [qualified examples](apps/website/src/routes/+page.server.ts), [shared theme](apps/website/src/app.css), [theme initialization](apps/website/src/app.html). Evidence: [desktop](.impeccable/review/native-art-desktop.png), [mobile](.impeccable/review/native-art-mobile.png), [320px](.impeccable/review/native-art-mobile-320.png), [mobile hero](.impeccable/review/native-art-mobile-hero.png).

**Key Characteristics:**
- True-black reading ground, neutral panels and a dark-gray navigation bar.
- Strong Geist headlines and Fira Code native source.
- Violet highlights and pill actions; original angular sculptural artwork.
- Product-specific language, useful source switching and direct onboarding.

## Colors

The landing pairs neutral black/gray reading surfaces with violet action and highlight colors. Exact source values live in the frontmatter. Documentation keeps its own neutral black reading theme and pale blue primary/ring value.

### Primary
- **Violet action / hover:** filled landing actions and their brighter hover state.
- **Navigation violet / hover:** compact header onboarding action; retains its distinct implemented pair.
- **Pale violet accent:** links, active-source underline and landing focus outlines.
- **Hero highlight:** the CPU/GPU phrase, preserving its distinct source value.

### Neutral
- **Background / text / muted / line:** true-black canvas, primary text, supporting explanations and dividers.
- **Header:** dark-gray navigation ground.
- **Source / source chrome / terminal:** near-black source body, selector strip and commands.
- **Section / footer:** subtle tonal separation across the lower page.
- **Documentation primitives:** neutral reading colors plus the existing pale-blue primary/ring; landing violet does not override docs.

**The Reading Ground Rule.** Keep prose and code on neutral dark surfaces; concentrate rich violet/coral material in the original artwork and violet action/highlight roles.

Both website and documentation default to black independently of the OS. SSR emits `html.dark`; the pre-hydration initializer reads stored `theme` or defaults to `dark`, persists it and falls back to dark when storage is unavailable. Explicit docs chooser preferences remain supported. Landing colors are locally authored. Shared dark tokens additionally define popover (`#111114`), primary foreground (`#08080a`), sidebar (`#050505`) and their foreground/selection aliases.

## Typography

**Display and body:** self-hosted Geist Variable, sans-serif fallback. **Source:** self-hosted Fira Code Variable, ui-monospace/monospace fallbacks with contextual/common ligatures enabled. Documentation uses the same family pairing. No serif family is imported or used in the current system.

The hero uses the display role in two product-specific lines, with the second phrase highlighted. Standard headings use the headline role; the overview heading uses (44px/1.15), and source-introduction heading (38px). Titles use (21px/1.3), weight (500). Hero explanation is (19px/1.7), max-width (490px); source introduction is (17px). Section introductions use (16px/1.75), max-width (750px); detailed copy is (14–15px/1.85). Navigation is (14px); hero action (17px); metadata (11–12px). Source uses (13px/1.9), command source (11px/2.15) and line numbers (10px).

At (1000px), hero type becomes `clamp(66px, 9vw, 90px)`, hero explanation (15px), navigation (12px) and command source (10px). At (760px), hero type is `clamp(47px, 9.2vw, 68px)`, source introduction heading (32px), overview heading (34px), general headings (29px), source (11px) and command source (11px). At (520px), hero type is `clamp(40px, 10.5vw, 54px)`, source tabs (11px) and command source (9px). The hero action becomes (16px) at 760px.

**The Source Has Its Own Voice Rule.** Keep factual prose and controls in Geist; use Fira Code for source, signatures and commands.

## Layout

The centered reading shell is `min(1200px, calc(100% - 96px))`; navigation uses `min(1200px, calc(100% - 64px))` with height (68px). The hero has minimum height (610px), content padding (90px) above/below and copy width capped at (740px). A static background fills its right side and continues (260px) below the hero, fading toward transparency. Headline, definition, actions and development-preview note stay grouped on the left.

The separate examples section pairs an explanatory column (300px) with a flexible source panel, gap (60px), and padding (40px / 70px). Principles use three equal columns with a (44px) gap. Numerical explanation uses (1.15fr / 1fr), gap (90px); onboarding (1fr / 1.1fr), gap (80px). Main lower sections use roughly (60–75px) vertical intervals. The platform comparison is a real table, and the close is centered.

At (1000px), the reading shell becomes `calc(100% - 64px)` and navigation `calc(100% - 48px)`; example columns become (240px / flexible), gap (30px). Hero minimum height is (580px), content padding (75px). At (760px), side gutters become (20px), major grids stack and the footer becomes a column. Hero minimum height is released; content padding becomes (58px / 65px). The artwork shifts crop to (35% top), extends right (-220px), continues below (-100px), and reduces opacity to (0.55). Source explanation precedes the code panel. Source height is bounded, with local overflow; the platform table maintains (570px) minimum width in its keyboard-focusable overflow region.

At (520px), navigation uses a Menu/Close disclosure, source gutters become (16px) and source bounds (230–330px). Actions and footer links wrap. Source lines can wrap anywhere inside their own panel; table overflow remains local. Check heading wraps, artwork contrast and source reachability at 320px.

## Elevation & Depth

No box shadows, lifted cards or tilted interface panels are used. Depth belongs to the original rendered sculpture: lit angular planes, violet faces and restrained coral reflections. The interface itself uses fine borders and near-black tonal separation.

**The Sculpture Is Artwork Rule.** The image supplies visual identity; it is static conceptual artwork, not a live GPU execution or performance visualization.

## Shapes

Landing actions are pills (30px radius), with a slightly tighter navigation action (28px). Source panels use (12px), terminals (6px), and mobile menu controls (5px). Fine borders are generally (1px); active source underlines and focus outlines are (2px). Reading surfaces are orthogonal. Authored SVG arrows use (16px) dimensions and stroke (1.6); decorative graphics remain hidden from assistive technology.

## Components

### Selected offset-merge identity

The user-selected mark is round-four B, [offset.svg](.impeccable/brand/round-4/offset.svg). Keep the exact path `M6 8h80v14H55L26 51H6V37h14l15-15H6Z` in its (92 × 64) viewBox. Its asymmetric merging paths are the identity; do not redraw, stretch or return to earlier bird/K/mascot proposals.

Landing navigation uses a contained mask at (36 × 25px), filled (`#e8e8ed`), beside live Geist lettering at weight (550). Docs use a contained image at (2rem × 1.375rem), equivalent to (32 × 22px) at the default root size. Explicit light docs use [the dark ink mark](apps/website/static/brand/kalandra-mark.svg), fill (`#171717`); dark docs use [the light mark](apps/website/static/brand/kalandra-mark-light.svg), fill (`#eeeef2`). The reusable Brand component has matching geometry at (40 × 28px), compact (32 × 23px), but is currently unused.

[Dark ink lockup](apps/website/static/brand/kalandra-lockup.svg) and [light lockup](apps/website/static/brand/kalandra-lockup-light.svg) combine this path with outlined Geist weight (550), viewBox (290.91 × 72). [SVG favicon](apps/website/static/favicon.svg) centers the same mark on a near-black rounded square, viewBox (64 × 64), background radius (14), fill (`#101014`); the path is transformed by `translate(6.7 15.8) scale(.55)` and filled (`#eeeef2`). The corresponding [32px PNG favicon](apps/website/static/favicon-32.png) is provided alongside it.

Integration evidence: [landing](.impeccable/review/offset-landing.png), [mobile landing](.impeccable/review/offset-landing-mobile.png), [dark docs](.impeccable/review/offset-docs.png), [mobile docs](.impeccable/review/offset-docs-mobile.png), [explicit light docs](.impeccable/review/offset-docs-light.png). Default docs remain dark; light-mode evidence exercises the explicit chooser.

### Actions and navigation

Primary actions use white text, violet fill and matching border, with the frontmatter action radius/padding. The hero enlarges this action to (17px) with padding (14px 25px) and icon gap (30px). GPU exploration is a text link beside it, with underline on hover. Header onboarding uses its own violet pill and hover pair. Action backgrounds/borders transition over (0.16s), without moving the element. Regular navigation brightens to white on hover. Mobile navigation exposes `aria-expanded`, `aria-controls` and visible Menu/Close text.

Landing focus is pale violet (2px), offset (5px). A focus-revealed skip link leads to main. Landmarks, headings and native anchors remain semantic. Shared docs controls retain a pale-blue (2px) ring, offset (2px), with (150ms) background/color transitions.

### Native source examples

The explanation and complete-source link sit to the left of the code on desktop and above it on mobile. The source panel contains a labeled native button group, filename/copy row and keyboard-focusable, labeled scroll region. Buttons expose `aria-pressed`; active choice has a visible pale-violet underline. The explanation updates through a polite live region. Decorative line numbers are hidden from assistive technology.

Copy feedback announces success or manual-copy fallback through a status region and resets after (2500ms) or a new selection. Actual examples come from qualified native fixtures through the server loader. Source size is (13px/1.9) desktop and (11px) on mobile, with wrap/scroll inside the panel. Under normal motion preference, focus within changes the panel border over (0.18s). The control group is a source selector, not an ARIA tablist.

### Original hero artwork

The decorative background uses [native-hero.webp](apps/website/static/art/native-hero.webp), with its exact generation prompt in [the asset sidecar](apps/website/static/art/native-hero.webp.json). It is a static violet/coral angular sculpture, not a logo, diagram or simulated output. Desktop uses `center top / cover` and a mask `linear-gradient(#000 75%, transparent)`; mobile applies the crop/opacity changes documented in Layout. The background does not intercept pointer input.

Only hero copy has a small entrance: (0.45s), easing `cubic-bezier(0.16, 1, 0.3, 1)`, translating from (8px) to rest. Content is visible by default. Under reduced motion, animations and transitions are disabled. There is no wire artwork, signal animation or animation control in this implementation.

### Numerical references, platform table and commands

Numerical references pair Fira Code signatures with short explanations across dividers. The platform table has real headers and rows, subdued header fill and local horizontal scrolling accessible by keyboard. The terminal is a flat bordered command container with a title, scrollable preformatted commands and native starter reference link. There are no landing input fields, badge/chip primitives or stacked solution-card navigation.

## Do's and Don'ts

### Do:
- **Do** preserve the accepted website and exact selected offset-merge geometry.
- **Do** preserve black defaults and explicit documentation theme preferences.
- **Do** keep the product-specific CPU/GPU proposition, original sculpture and real native source central.
- **Do** retain readable artwork contrast, keyboard focus and reduced-motion behavior at 320px.
- **Do** keep documentation neutral while landing actions/highlights use violet.

### Don't:
- **Don't** copy another language site's giant-name, adjective-tagline and stacked-solution-card composition.
- **Don't** restore serif headlines, wire artwork, cartoon processors, tile toys, stickers or tilted panels.
- **Don't** introduce green, emojis, fabricated benchmarks or browser execution claims.
- **Don't** imply model loading, a full inference runtime or CUDA support.
- **Don't** return JavaScript-era public material to the current native language story.
