# Scene companions: a scene theme can give Biscuit its own drawing

A follow-up to the Beyond the Walls theme (apply that one first: this patch is made against tag `v4.0.0-preview.6` with
`walls-registration.patch` applied and `extension/themes/walls/` in place).

This lets a scene theme dress Biscuit, the built-in companion, in a drawing of its own: an ordinary `.chpet` pack in the scene's folder, named in `scene-themes.js`. While that scene is on and the student has not chosen a companion pack of their own, Biscuit wears the scene's drawing, keeping its name and settings; on any other scene Biscuit is the pony again, and a pack the student picks in Make it yours always wins.

## How it works

- `scene-themes.js` gets a small `companions` map, next to the `api` line, and `companion(id)`, which returns `themes/<id>/<file>` or `''`. This issue declares one: `walls: 'companion.chpet'`.
- `pet-art.js` gets `scenePack(id, file)`. It reads the file from the extension's own files with `fetch(chrome.runtime.getURL(file))`, once per scene per page, when the browser is idle after the first paint, and checks it with `ReservePetPack.validate`, the same check an installed pack goes through. A missing file, a bad pack or no checker (the Appearance editor off) resolves to `null` quietly, is not read again, and Biscuit stays the pony. `identity()` accepts that pack only while its scene is the saved scene and no pack of the student's is chosen, and keeps Biscuit's own name, kind and motion (no pose switches, as for the pony).
- `dashboard.js` `syncCompanion()` asks for the scene's pack when the student has no pack chosen, keyed by the file alone (so renaming Biscuit keeps the drawing), and hands it over through the existing `companionPack`, so the walking companion, the Home card, the Features preview and Make it yours all agree. Leaving the scene brings the pony back in the same render; entering it costs one extra render when the pack arrives.
- `companion.chpet` is listed with the walls folder's other files: the scene-themes assets in `features.js` and both `web_accessible_resources` lists in `manifest.json`.

## What is in this zip

- `extension/themes/walls/companion.chpet`: the scout's horse, an ordinary chpet v1 pack (3.9 MB)
- `scene-companion.patch`: the mechanism, the walls declaration and its tests (9 files, +175 / -10)
- `SCENE-COMPANION.md`: this note

## Apply

    unzip scene-companion.zip -d /path/to/canvas-harness   (adds extension/themes/walls/companion.chpet, this note and the patch)
    cd /path/to/canvas-harness
    git apply scene-companion.patch
    npm test

## The patch

`scene-themes.js` (the `companions` map with `walls`, and `companion(id)`), `pet-art.js` (`scenePack` and the scene check in `identity()`), `dashboard.js` (`syncCompanion`), `features.js` and `manifest.json` (the new file in the walls lists), `docs/portable-packs.md` (one paragraph), `tests/scene-frame-performance.test.cjs` (one line, for the new api name), `tests/scene-manifest.test.cjs` (the walls folder now holds 12 files) and the new `tests/scene-companion.test.cjs`.

## The horse

"Scout's horse": a bay scout's horse with a black mane, a green saddle cloth with cream trim and leather saddlebags,
drawn in the theme's ink-and-cel style. Box 58 x 72, ground 68, facing right
(pets.js shows it 58 px wide at the medium size, 46 and 74 px at small and large). Every pose is an
animated WebP at 4x (232 x 288) that loops seamlessly; with motion off or reduced motion the extension shows the first
frame of the standing pose, as it does for any animated pack. The same file also works as an ordinary pack:
Make it yours -> More -> Add from a file, then Apply.

| pose | what it shows | type | size |
| --- | --- | --- | --- |
| `stand` | Standing: Breathes, blinks, flicks an ear, swishes its tail and tosses its head now and then. | image/webp | 407 KB |
| `walk` | Walking: A four-beat walk along the panel tops, hooves planted, head nodding with each stride. | image/webp | 228 KB |
| `trot` | Trotting: A two-beat trot with a little bounce, mane and tail bouncing, when it hurries. | image/webp | 135 KB |
| `lie` | Lying down: Legs folded under, head up, breathing slowly. | image/webp | 348 KB |
| `sleep` | Asleep: Head low, eyes shut, slower and deeper breaths. | image/webp | 282 KB |
| `read` | Reading: Head lowered over a small open book; a page turns now and then. | image/webp | 415 KB |
| `eat` | Eating: Muzzle in a little pile of hay, chewing. | image/webp | 252 KB |
| `cheer` | Cheering: Rears up proudly with its front hooves paddling when you finish something. | image/webp | 355 KB |
| `flag` | Carrying a flag: Holds a small green pennant in its teeth and waves it. | image/webp | 209 KB |
| `fall` | Falling: Legs splayed and mane flying, eyes wide, when it is dropped. | image/webp | 107 KB |
| `held` | Picked up: Dangles sheepishly by the withers, swaying, when you pick it up. | image/webp | 287 KB |

## Making another scene's companion

Draw the companion as an ordinary `.chpet` (see `docs/portable-packs.md`), put it in the scene's folder as `companion.chpet`, add `<id>: 'companion.chpet'` to the `companions` map in `scene-themes.js`, and list `themes/<id>/companion.chpet` in the scene-themes assets in `features.js` and in both resource lists in `manifest.json`. `node scripts/check-pack.cjs extension/themes/<id>/companion.chpet` checks the file.
