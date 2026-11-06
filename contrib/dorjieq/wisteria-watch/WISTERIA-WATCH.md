# Wisteria Watch: a 4.0 scene theme (id `wisteria`)

A sixth scene theme in the same format as Under the Sea, Starry Night, Starfield, Blueprint and Beyond the Walls.
A wisteria grove at golden hour, painted like an anime film background: mossy trunks, a canopy of small sunlit leaves,
cream haze, a glowing meadow, and wisteria hanging from the trees. Three young slayers rest under it before the night's
watch while one of them lights a stone lantern.

All the art is original: original characters in an anime style (no characters from the show that inspired it, none of
their patterns, masks or marks), no logos, emblems or lettering, and the show's name appears in none of the files.

## What is in this zip

- `extension/themes/wisteria/`: the eleven theme files (sky.mp4, poster.jpg, six icons, two frames, theme.css)
- `wisteria-registration.patch`: adds `wisteria` to every hard-coded scene list, plus the matching tests
  (22 files, +84 / -44), made against tag `v4.0.0-preview.6` with the Beyond the Walls theme and the Scene
  companions change applied (it sits next to `walls` in the same lists)
- `WISTERIA-WATCH.md`: this note

## Apply (after Beyond the Walls and Scene companions)

    unzip wisteria-watch-theme.zip -d /path/to/canvas-harness   (adds extension/themes/wisteria/, this note and the patch)
    cd /path/to/canvas-harness
    git apply wisteria-registration.patch
    npm test

## The six course icons, in rail order

The course rail deals them out in this order (All courses gets the first); small badges elsewhere use
(index + 3) mod 6.

| # | motif | what it shows |
| --- | --- | --- |
| 1 | `slayer` | The young slayer in the indigo wave-scale haori, a hand on the hilt. First in the list, on All courses. |
| 2 | `moon` | The full moon over the dark trees, and two small eyes watching from them: what the watch waits for. |
| 3 | `trainee` | The trainee in the moss-green haori, mid-swing with a practice sword. |
| 4 | `wisteria` | A raceme of wisteria, the flower that keeps the night away, petals falling. |
| 5 | `crow` | The messenger crow on a branch, its red cord and rolled letter. |
| 6 | `lantern` | The slayer in the plum arrow-feather haori lighting the stone lantern with a taper. |

## The banner

- **The grove**: dark mossy trunks frame both sides, a canopy of small pointed leaves with sunlit tops, cream haze with
  soft far trees, and a meadow glowing yellow-green with tiny white flowers. Wisteria hangs in long racemes from the
  canopy, deep violet near the stem and paler lavender toward the tip.
- **The watch**: three original slayers rest on the right, below the toolbar and clear of the date row: one sits on a
  rock with his sheathed sword planted beside him, one kneels to light the stone lantern with a long taper, and one
  stands with his back to us, sword in hand, looking out over the meadow.
- **In the loop** the wisteria sways in the breeze, petals drift down through the light, the taper and the lantern
  flicker and the sun's rays breathe. The left side stays calm and soft so the greeting reads.

## The theme folder

| file | spec |
| --- | --- |
| sky.mp4 | moving banner, 2560x704 H.264 yuv420p, 30 fps, 16 s seamless loop, no audio, faststart, 2.5 MB |
| poster.jpg | still banner, 2560x704, 449 KB (shown for Still, Off, reduced motion and idle rest) |
| icon-slayer / moon / trainee / wisteria / crow / lantern .png | 112x112 course icons, in rail order, 100 KB together |
| wisteria-card.png | 200x200 nine-slice, `border-width:24px; border-image:url(wisteria-card.png) 56 fill round`, 26 KB |
| wisteria-panel.png | 360x360 nine-slice on `::before`, `inset:-18px; border-width:40px; border-image:url(wisteria-panel.png) 100 fill round`, 84 KB |
| theme.css | all styles, scoped to `.rd[data-theme-kit]`, 22 KB |

The frames are a wisteria trellis: cedar beams lashed with red cord at every crossing, wisteria hanging from the top
corners, a little moss at the foot. The beams' grain repeats exactly over each middle segment, so the edges tile
without seams when `round` scales them.

theme.css follows the Beyond the Walls stylesheet rule for rule (same fixes for the rail, the frames' room and the
Help band); what differs is the look: moss-green shade under the banner, a pressed-wisteria chosen tab, an indigo
wave-scale main button, cedar buttons, a twisted red cord under section headings, turned-cedar tick circles, and a few
wisteria petals drifting past the panels now and then.

## What the patch registers

scene-themes.js (motifs `slayer, moon, trainee, wisteria, crow, lantern` and the name), page-preferences.js, customization-model.js, dashboard.js,
dashboard-view.js, customize-ui.js (picker card, owner name, colours), scene-themes.css (toolbar plate), manifest.json
(both resource lists), features.js (asset list), biscuit-parse.js and biscuit-controls.js (so "wisteria watch" or
"wisteria theme" sets it), focus-room.js (comment), review-deck.css and grade-impact.css (room colours for the
theme), and the tests that list scenes.

## Notes

- Still, Off and reduced motion hide the video, show the poster and stop every theme animation, the drifting petals
  included (their rule outranks the generic stop rule, so theme.css stops them itself).
- The Biscuit rule packs (biscuit-rules/*.json) do not mention wisteria yet; they need retraining. Nothing breaks
  without it.
- A separate follow-up (its own issue and zip) gives Biscuit a messenger crow on this scene, through Scene companions.
  This theme does not need it.
