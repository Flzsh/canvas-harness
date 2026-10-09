# Review checklist

Go through this before handing anything over. Fix what fails; do not explain it away.

## A. Will it upload?

- [ ] One `<svg>` root with `xmlns` and a `viewBox` (banner 1680x240, icon 100x100, border 360x110).
- [ ] Only allowed elements; no `data-*`, `aria-*`, `role`, namespaced attributes, scripts, images, links, markers.
- [ ] No `var()`, no outside `url()`, no `@import`/`@font-face`, no `offset-path`, no animated `d`.
- [ ] SMIL clocks are plain times; no `begin="x.end"` or events.
- [ ] Under 256 KiB (aim: banner 70 KB, icon 6 KB, border 14 KB).
- [ ] `node scripts/check.cjs <folder>` says `accepted` for every file, with no `!` warnings left unexplained.

## B. Is the still picture right?

Imagine every animation removed (this is what reduced-motion users see).

- [ ] The picture is complete: nothing missing, nothing that should be hidden is showing.
- [ ] It shows the most telling moment, not a neutral pause.
- [ ] Every `@keyframes` starts and ends on the rest value; every duration divides the cycle.

## C. Does it show the course?

- [ ] A person who takes this course would say "that is what we do".
- [ ] Everything is correct for the subject (formulae, spellings, instruments, period, notation).
- [ ] No room shell: no doors, walls, windows, clocks, notice boards, bins.
- [ ] Three to five things shown fully, not eight hinted at.

## D. Does each object make sense? (go object by object)

- [ ] A stranger can name it.
- [ ] Something drawn holds it up.
- [ ] Its outline is whole; no faded or hidden ends.
- [ ] It belongs to the course; it is not filler.

## E. Is it one image?

- [ ] One ground line and ground wash from edge to edge; one light; one scale.
- [ ] Groups overlap or share something; something crosses every gap.
- [ ] No equal blocks at equal spacing; no blank stretch; no isolated little props in a row.
- [ ] The upper half is used by something tall and supported.
- [ ] At a quarter of its size it still has a clear pattern of darks and lights (not beige on cream).

## F. Is it the hand?

- [ ] No ruled lines, no perfect circles or rectangles, no two repeated things identical.
- [ ] Washes sit loosely against their outlines; most of the paper is bare.
- [ ] Figures follow the cast model: round faceless head, one-stroke torso, two-part arms and legs, a foot, one accessory.
- [ ] Full-strength ink on near things; only far things are pale.
- [ ] No gradients, glows, blurs, drop shadows, glossy highlights.

## G. The title

- [ ] The letters are made of the subject; nothing merely stands beside plain lettering.
- [ ] The name reads in under a second at 80 px tall.
- [ ] Clean: no texture of tiny repeated pieces, no scattered small marks.
- [ ] Each colour stands for something; the letters are not black by default.
- [ ] Hand-drawn letterforms that could not be mistaken for a font. No `<text>`.
- [ ] Its tone fits the subject.

## H. The motion

- [ ] No shaking, wobble, idle sway or pulse. Whoever is not acting is still.
- [ ] Every actor: goal, action, visible result, reset. One main event crosses the banner.
- [ ] Anticipation, action, settle, rest; holds of at least half a second.
- [ ] Nothing mirrored. Planted feet do not slide. Hands stay on what they hold.
- [ ] Read at eight evenly spaced moments: nothing detached, half-hidden or passing through something.
- [ ] Continuous motion only on things that never stop.

## I. Icon and border

- [ ] Icon: one thing standing on the page, no circle or tile round it, recognisable at 22 px, one action then rest.
- [ ] Border: art only on the edges and corners; the middle is empty; a plain floor line bottom-left for the icon;
      `vector-effect="non-scaling-stroke"` on strokes.
- [ ] Border: its own deep ink colour; a corner signature; something travels a long way along an edge each cycle.
- [ ] Border still looks right on a 255 x 56 row and a 300 x 132 row, with the icon standing in its bottom-left corner.
- [ ] Icon and border look like a pair, and unlike any other course's.

## J. Respect

- [ ] People, cultures and periods are drawn with real, specific detail and without caricature.
- [ ] Nothing private about the user or their school appears in the artwork unless they asked for it.
