# Vesperio / Glyph Pack — V1.1

Transcribed 2026-07-11 from the Claude Design brand sheet Florian supplied
(it never shipped in the original handover package; this file is now the
in-repo canon). Header rule: **no icon font — unicode + brackets do the
work**. Do not import Lucide / Heroicons; the vocabulary is typographic.

## 01 · Core set — the entire iconography

| Glyph | Codepoint | Meaning |
|---|---|---|
| → | U+2192 | link / action |
| ✕ | U+2715 | close / clear |
| + | U+002B | add / zoom |
| − | U+2212 | remove / zoom |
| ◆ | U+25C6 | status / state |
| ▲ | U+25B2 | alert / rising |
| ● | U+25CF | live / source |
| ■ | U+25A0 | legend / check |
| / | U+002F | delimit / search |

## 02 · Status glyphs — role color, ≤12px, never on running text

| Mark | Role | Hex (night) |
|---|---|---|
| ● | LIVE | 39FF6A |
| ▲ | ALERT | FF2E1E |
| ◆ | CRITICAL | FF8A00 |
| ◆ | TELEMETRY | 00F0FF |
| ▲ | ANOMALY | FF2ED2 |

## 03 · In badges

Dim-hue border + colored text + glyph. FILLED is reserved for
NOTABLE (yellow) / FAILURE (red) on the sheet. Neutral count chips
(e.g. `42`) carry no hue.

> Repo divergence, ruled by Florian 2026-07-11 ("if it contradicts what
> we have implemented, don't worry about it"): on the live site the
> yellow FILLED badge is MAJOR and NOTABLE is the outlined info-blue
> chip (DESIGN_TUNING_LOG rules 51/51b). The badge GRAMMAR (dim border +
> colored text + glyph; filled = the two loudest states) is the canon;
> the tier-to-color mapping follows the tuning log.

## 04 · Brackets + arrows — controls and links

- Controls are bracketed: `[+] [−] [ON] [OFF] [R] [✕]`; a toggle in the
  OFF state renders in text-3.
- Search is slash-prefixed: `/ filter: entity, operator or provider...`
- `→` marks links and actions, ALWAYS CYAN: `FACTS, EVENTS & SOURCES →`,
  `2 SOURCES →`.
- Slashes as delimiters: `LONG MARCH 11 / CHINA AEROSPACE`.

## 05 · Legend marks + meters — squares, not circles (radio is the one exception)

- `■` SAT — checkbox: literal square, checked; `□` unchecked.
- `●` ORB — radio: literal circle, selected.
- `■` layer key square — legend color mark.
- Segmented meter — green, always.
- The LIVE dot doubles as the SNR / source-quality mark.
- Fill bar — white on n3, no rounding.

## Governed mode (footer rule)

Role colors appear ONLY as glyphs ≤12px, layer squares, or badges —
never on running text. The vocabulary is typographic.
