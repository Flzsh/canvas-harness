# Beyond the Walls: a 4.0 scene theme (id `walls`)

A fifth scene theme in the same format as Under the Sea, Starry Night, Starfield and Blueprint.
Dusk on the last walled town: a colossal stone wall with a gate, red roofs and a burning sky. Scouts of an
original wall corps keep watch on the battlements and one fires a green signal flare. On the near tower five scouts
stand at the parapet with their backs to us, cloaks streaming in the wind and a lantern lit, looking out at the calm,
ancient giants far out on the plain beyond the wall, steam rising off their heads and shoulders.

Drawn in the style of a modern dark-fantasy anime. All the art is original: original characters (no characters
from the show that inspired it), no logos, emblems or show lettering, and the show's name appears in none of the files.

## What is in this zip

- `extension/themes/walls/`: the eleven theme files (sky.mp4, poster.jpg, six icons, two frames, theme.css)
- `walls-registration.patch`: adds `walls` to every hard-coded scene list, plus the matching tests
  (22 files, +84 / -44), made against tag `v4.0.0-preview.6`
- `BEYOND-THE-WALLS.md`: this note

## Apply

    unzip beyond-the-walls-theme.zip -d /path/to/canvas-harness   (adds extension/themes/walls/, this note and the patch)
    cd /path/to/canvas-harness
    git apply walls-registration.patch
    npm test

## The six course icons, in rail order

The course rail deals them out in this order (All courses gets the first); small badges elsewhere use
(index + 3) mod 6.

| # | motif | what it shows |
| --- | --- | --- |
| 1 | `salute` | A young recruit pledging her heart, fist over the chest. First in the list, on All courses. |
| 2 | `giant` | One of the giants beyond the wall, calm and ancient, steam rising. |
| 3 | `captain` | The veteran captain pointing the advance. Also shown on empty pages. |
| 4 | `hand` | A giant's hand rising out of the steam toward the sky, swallows circling. |
| 5 | `lookout` | A scout on the battlements with a spyglass. |
| 6 | `flare` | A scout firing a green signal flare. |

## The banner

The same dusk as round 1 (the wall and its gate, the red-roofed town, the sunset sky, swallows, steam), now with
the cast:

- **Giants far beyond the wall**: calm, ancient giants stand far out on the plain, so far that the haze turns them
  lilac, yet their heads and shoulders still tower above the wall line. They stand in the steam with a thin warm rim
  of sunset light and softly glowing amber eyes, and move very slowly in the loop. They never touch the wall.
- **Scouts on the battlements**: small cloaked scouts of the corps stand along the parapet walkway, cloaks
  fluttering. One fires a green signal flare that climbs and fades within the loop, so nothing is in the air at the
  loop point.
- **The watch**: in the right foreground, below the Home's toolbar, five scouts stand at the near tower's parapet,
  seen from behind and in lost profile, looking out over the wall at the giants and the low sun: a lookout holding
  a lantern low, a scout with an auburn braid resting a hand on the youngest's shoulder, the youngest leaning on the
  coping, the silver-haired captain with one boot up on the coping, and a scout standing apart with arms folded.
  They are backlit, with warm rims on the sun-facing edges. In the loop the wind streams their cloaks, hair and
  braid to the left and one gust builds and passes; each breathes on its own rhythm, heads turn a little, and the
  lantern swings and flickers, lighting the cloaks and legs near it. The poster (the still banner) shows the calm
  moment before the gust.
- The greeting area on the left stays calm and dark so the white heading reads.

## The theme folder

| file | spec |
| --- | --- |
| sky.mp4 | moving banner, 2560x704 H.264 yuv420p, 30 fps, 16 s seamless loop, no audio, faststart, 2.6 MB |
| poster.jpg | still banner, 2560x704, 345 KB (shown for Still, Off, reduced motion and idle rest) |
| icon-salute / giant / captain / hand / lookout / flare .png | 112x112 course icons, in rail order, 139 KB together; the captain is the empty-state showpiece |
| walls-card.png | 200x200 nine-slice, `border-width:24px; border-image:url(walls-card.png) 56 fill round`, 32 KB |
| walls-panel.png | 360x360 nine-slice on `::before`, `inset:-18px; border-width:40px; border-image:url(walls-panel.png) 100 fill round`, 91 KB |
| theme.css | all styles, scoped to `.rd[data-theme-kit]`, 21 KB |

## What the patch registers

scene-themes.js (motifs `salute, giant, captain, hand, lookout, flare` and the name), page-preferences.js,
customization-model.js, dashboard.js, dashboard-view.js, customize-ui.js (picker card, owner name,
colours), scene-themes.css (toolbar plate), manifest.json (both resource lists), features.js (asset list),
biscuit-parse.js and biscuit-controls.js (so "beyond the walls" or "walls scene" sets it), focus-room.js
(comment), review-deck.css and grade-impact.css (room colours for the theme), and the tests that list scenes.

## Notes

- Still, Off and reduced motion hide the video, show the poster and stop every theme animation, the panel
  embers included (their rule outranks the generic stop rule, so theme.css stops them itself).
- The Biscuit rule packs (biscuit-rules/*.json) do not mention walls yet; they need retraining. Nothing
  breaks without it.
- A separate follow-up (Scene companions, its own issue and zip) lets this scene give Biscuit a scout's horse in
  place of the pony. This theme does not need it.
