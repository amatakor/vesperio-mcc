# MCC_HERO_BRIEF — redesign the SATELLITES TRACKED hero

Brief for Claude Design, from the Vesperio production repo (2026-07-10).
Same flow as SNR_MARK_BRIEF: explore directions, Florian picks, deliver a
handoff with exact values, production implements 1:1. The canonical V1.1
system and DESIGN_TUNING_LOG.md (39 locked rules) live in the design
project; this brief cites them and restates what is load-bearing.

## The ask

The SATELLITES TRACKED count on /mcc/ (currently 12,305) is the single
most impressive fact the platform owns: the machine is live-tracking the
whole commercial sky. Florian: "it deserves more attention. It's the
hero of the site." Today it renders as a quiet 44px mono number in the
HUD rail's top-left module and reads as one stat among many (the flow
chart, countdown, and vehicle bars sit right under it, at similar visual
weight).

Design task: give this figure hero presence and ceremony ON the MCC
instrument page, without breaking the V1.1 laws or stealing the eye from
the earth itself (tuning rule 15's spirit: instruments are cards among
cards; the canvas is the star — the hero number is the ONE sanctioned
exception, so decide how far to push it).

Deliver 2–3 distinct directions, annotated, both themes, then a
production handoff for the chosen one (README as source of truth: exact
px, weights, tracking, tokens, spacing steps, states).

## Current implementation (production truth)

- Markup (src/orbits/chrome.tssx, HudColumn): a `.hud-module` containing
  `.hud-label` ("SATELLITES TRACKED", instrument register) and
  `.count-big` (the number).
- `.count-big` today: IBM Plex Mono 500, 44px, line-height 1.1,
  tabular-nums, letter-spacing .02em, color `var(--acc)`.
- `--acc` is a LEGACY ALIAS that resolves to volt (#ADFF00 dark /
  #64C400 light). Under the V1.1 color law the count is DATA and should
  never be volt (volt = shell chrome + LCD clocks only). The redesign
  must land the number on a lawful color. This is the moment to fix it.
- Placement: top module of the left HUD rail, floating over the WebGL
  globe. Below it (same rail): ORBITAL FLOW chart, T-MINUS launch
  countdown (constant-black LCD instrument, rule 16), LAUNCHES BY
  VEHICLE bars.
- The value updates only when the orbits data refreshes (scheduled cron,
  roughly daily), not live on screen. Today 5 digits + comma; design for
  6 digits + comma without reflow (tabular digits or equivalent).
- Viewports 1440 down to 375 both matter. The rail collapses on mobile.

## Locked decisions that bind this design

1. NO LCD face for this number (Florian, 2026-07-07, in-code comment):
   the count must render every glyph the data can produce (no 7-segment
   tofu) and digits must not shuffle as the value changes. The LCD look
   stays reserved for the clocks.
2. MCC THEMES (tuning rule 3): dark = night-ops, light = daylight chart
   (ocean #E6EBEE, coast steel). The hero must be designed for BOTH.
   MCC is no longer constant-dark.
3. Color governance 90/9/1: volt #ADFF00 is logo + app shell + LCD
   clocks ONLY, never data. Constants: links cyan, meters + live dots
   green, yellow strictly NOTABLE fills. Role accents (--acc-*) only as
   glyphs ≤12px, layer squares, badges. If the hero number needs a
   color, argue it from this law (foreground ink is always lawful;
   a new sanctioned use needs Florian's explicit sign-off in the
   handoff).
4. Typography voices: IBM Plex Sans = DISPLAY voice (light register,
   ALWAYS uppercase; the V1.1 hero-number spec is 52px/weight 200 —
   note Plex Sans 200 has no tabular figures guarantee; if you propose
   the display voice, address the digit-shuffle constraint from lock 1).
   IBM Plex Mono = DATA voice, never bold, weight cap 500, tabular
   numerals. Space Grotesk = wordmark only.
5. House laws: no border-radius, no shadows, no glow, no gradients, no
   transform hovers. One frame per section; frames belong to CONTENT
   blocks. Spacing on the 4px grid (named steps 4/8/12/16/20/28/40/64).
6. The sweep-countdown instrument face and monogram tiles are the only
   constant-dark survivors (rules 2/16); do not add new constant-dark
   surfaces without calling it out.

## Directions worth exploring (suggestions, not constraints)

- Scale + isolation: the number at true display scale (V1.1 hero spec
  or beyond), label and as-of demoted, generous 4px-grid air, the rest
  of the rail pushed down — presence through hierarchy, not decoration.
- Context ring: pair the count with its motion (delta over 30 days:
  launched / deorbited already exist in the data as the ORBITAL FLOW
  numbers) so the hero states a living fact, not a static census.
- Instrument framing: give it the "one frame per section" content frame
  and a hairline-labeled module of its own, separated from the launch
  cluster — the rail currently reads as one undifferentiated stack.
- A restrained count-up on first paint is the ONE motion that could be
  argued (page-load only, reduced-motion safe, ≤120ms-per-step family);
  no persistent animation.

## What to attach when running this brief

1. Two screenshots of the current /mcc/ hero area, dark + light theme
   (take fresh ones from the live preview).
2. DESIGN_TUNING_LOG.md (the design project already has it; rules 3,
   15, 16 are the ones this brief leans on).
3. Token excerpt (from src/index.css, dark then light where they
   differ): --volt #ADFF00, --volt-ink #64C400, --clock=var(--volt),
   --live=green accent, --globe-ocean #0B1626 / #E6EBEE, --globe-coast
   #4D6980 / #33495A, text inks --n8 ladder, fonts IBM Plex Sans /
   IBM Plex Mono (self-hosted), spacing steps 4/8/12/16/20/28/40/64,
   control heights 24/32/40.

## Deliverables checklist (what production needs back)

- Chosen direction as an annotated mock, dark AND light.
- README with exact values: font/weight/size/tracking/line-height,
  color tokens (existing tokens preferred; any new token needs a name,
  both theme values, and a one-line law justification), spacing steps,
  module frame spec, mobile behavior.
- The RULE paragraph, written to be pasted into DESIGN_TUNING_LOG.md as
  the next numbered rule (system-level statement + IMPLEMENTATION
  pointer), so production and the design project stay in sync.
- Explicit statement of what happens to the legacy --acc volt color on
  this number.
