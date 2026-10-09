# The file format Canvas Harness accepts

Canvas Harness shows uploaded artwork as an **isolated image**: the SVG is validated, stored, and rendered through an
`<img>` (a data URL). It is never injected into the page. Three consequences drive everything below:

1. **Nothing from the page reaches the drawing.** No page fonts, no CSS variables, no `currentColor`, no course colour,
   no theme. Every colour is written into the file.
2. **No scripts and no outside resources.** Only self-contained CSS (`<style>`, `@keyframes`) and SMIL can animate.
3. **A static copy is made automatically** for people who use reduced motion or switch animation off: every animation
   is stripped and what remains is shown. So the drawing with all animation removed must be the complete picture
   (see "The rest pose" in `animation.md`).

Checked against Canvas Harness 2.19.0 (`extension/custom-art.js`, unchanged since 2.18.1). `scripts/check.cjs` runs that same validator.

## The three slots

| Slot | Recommended `viewBox` | How it is shown | Notes |
|---|---|---|---|
| **Banner** (with the lettered title inside it) | `0 0 1680 240` | A strip across the course heading, 80, 140 (default) or 220 px tall depending on the user's banner size. Default fit is **contain, aligned right**; the user can switch to **cover** and to left/centre. | Transparent background. See `slots.md` for the safe areas. |
| **Icon** | `0 0 100 100` | 40 x 40 px in the bottom-left corner of the course row, 22 x 22 px beside the course name elsewhere. | Must read at 22 px. |
| **Border** | `0 0 360 110` | Stretched over the whole course row (`preserveAspectRatio="none"`); the row's icon and text sit in the middle. A row is typically about 255 x 87 px. | Hollow and transparent in the middle: art only on the edges and corners. |

"All courses" (the overview) has its own banner, icon and border slots; treat it as one more course.

## Hard limits

- 256 KiB per file (raw and after normalising); 2 MiB for all of a user's artwork together. Aim far lower:
  banner <= 70 KB, icon <= 6 KB, border <= 14 KB.
- At most 4,096 elements, nesting at most 64 deep, at most 60 attributes on one element.
- One `d` attribute holds at most 8,192 numbers and letters. Split very long paths.
- All CSS together at most 64 KiB; at most 16 `<style>` elements.
- XML 1.0, UTF-8, one `<svg>` root with `xmlns="http://www.w3.org/2000/svg"` and a `viewBox`.

## Allowed elements

`svg g defs symbol use path rect circle ellipse line polyline polygon linearGradient radialGradient stop clipPath mask
pattern filter feGaussianBlur feOffset feBlend feComposite feColorMatrix feFlood feMerge feMergeNode feMorphology
feTurbulence feDisplacementMap feDropShadow title desc style text tspan textPath animate animateTransform animateMotion
set`

Not allowed (the upload is refused): `script`, `image`, `foreignObject`, `a`, `marker`, `switch`, `view`, nested `svg`,
anything with a namespace prefix (`inkscape:`, `sodipodi:`, `xlink:` other than `xlink:href`), `<!DOCTYPE>`, entities,
processing instructions.

House style uses only `svg g path style` plus, when needed, `defs clipPath animate animateTransform animateMotion`.
Avoid `text` (no fonts reach the image; the lettering is drawn), avoid filters (slow, and not the look).

## Allowed attributes

On every drawable element: `id class style transform opacity fill fill-rule fill-opacity stroke stroke-opacity
stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset color visibility
display filter clip-path clip-rule mask vector-effect paint-order shape-rendering overflow pointer-events`
plus the element's own geometry (`d`, `pathLength`, `x`, `y`, `width`, `height`, `rx`, `ry`, `cx`, `cy`, `r`,
`x1`..`y2`, `points`).

**Any other attribute is refused**, including every `data-*` attribute, `aria-*`, `role`, `tabindex`, `xml:id` and
event handlers (`onclick`...). Class names are letters, digits, `_` and `-`, starting with a letter or `_`.
Ids start with a letter or `_`. `href` may only be a local `#id`.

## Allowed CSS

- Rules, `@media`, `@keyframes` (and `@-webkit-keyframes`). No `@import`, `@font-face`, `@supports`, no nested rules.
- Selectors: type, `.class`, `#id`, `*`, `:nth-child()`-style pseudo-classes, attribute selectors, `> + ~`.
- Properties: `fill fill-rule fill-opacity stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin
  stroke-dasharray stroke-dashoffset color stop-color stop-opacity opacity transform transform-origin transform-box
  filter clip-path mask display visibility paint-order shape-rendering vector-effect overflow pointer-events`,
  the `font-*`/`text-anchor`/`letter-spacing` group, `animation` and all `animation-*`, `transition` and all
  `transition-*` (and their `-webkit-` forms).
- **Refused:** `var()`, `attr()`, any `url()` that is not `url(#localId)`, and every property not in the list above:
  `offset-path`, `d` (no CSS path morphing), `mix-blend-mode`, `will-change`, `isolation`, `cursor`...
  Values may not contain `@`, a backslash, `/*`, or the characters `{ } < > ;`.
- `calc()`, `rotate()`, `translate()`, `scale()`, `cubic-bezier()`, `steps()`, `rgb()`, `hsl()` are fine.
- **A CSS rule beats a presentation attribute.** If a class sets `stroke`, a `stroke="..."` attribute on the same
  element is ignored. Give differently coloured strokes their own class. (`scripts/check.cjs` warns about this.)

## Allowed SMIL

- `animate` may target only: `x y cx cy r rx ry width height x1 x2 y1 y2 opacity fill stroke fill-opacity
  stroke-opacity stroke-width stroke-dashoffset stop-color stop-opacity`.
  **`d` cannot be animated**: there is no path morphing in this format. Movement comes from transforms, travel along a
  path, drawing-on, and switching between drawn poses (see `animation.md`).
- `animateTransform` (types `translate scale rotate skewX skewY`), `animateMotion` (with `path`, `rotate`,
  `keyPoints`), `set`.
- Clock values are plain times only: `begin="2.5s"`, `dur="12s"`, `repeatCount="indefinite"`. Event and sync-base
  values (`begin="click"`, `begin="a.end"`) are refused.
- `calcMode` `linear | discrete | paced | spline`; `fill` `freeze | remove`.

## What gets a file refused most often

| Symptom in the upload dialog | Cause | Fix |
|---|---|---|
| "Unsupported SVG attribute data-..." | exporter or rig metadata | delete every `data-*`, `aria-*`, `role` |
| "Unsupported or unsafe SVG element <image>/<marker>/<foreignObject>" | embedded bitmap, arrowhead markers, HTML text | redraw as paths |
| "SVG namespace prefixes are unsupported" | Inkscape/Illustrator export | export "plain SVG", strip `inkscape:`/`sodipodi:` |
| "Unsafe CSS function" | `var(--x)` | write the value out |
| "Unsafe SVG animation attributeName d" | path morph | use transforms or pose switching |
| "Unsupported SVG animation clock" | `begin="x.end"` | use absolute times and one shared cycle length |
| "Unsupported SVG CSS property" | `offset-path`, `mix-blend-mode`, `will-change`... | remove |
| "SVG file exceeds the 256 KiB upload limit" | too many points | fewer, longer paths; one decimal place |

## Writing compact paths

One decimal place is enough at these sizes. Prefer one absolute `M` followed by relative `c`/`q`/`l` segments. Put
strokes that share weight and colour in one `path` with several `M` sub-paths. Whitespace and XML comments are
allowed but count toward the size; ship without comments.
