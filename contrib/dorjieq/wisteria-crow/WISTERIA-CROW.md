# Wisteria Watch: Biscuit as a messenger crow

A small follow-up to the Wisteria Watch theme. It uses Scene companions (the change that lets a scene give Biscuit its
own drawing, which came with Beyond the Walls): while Wisteria Watch is on and the student has not picked a companion
pack of their own, Biscuit becomes a messenger crow, keeping its name and settings. On any other scene Biscuit is the
pony again (or the scout's horse on Beyond the Walls), and a pack the student picks in Make it yours always wins.

Apply it after the Wisteria Watch theme (`wisteria-registration.patch`), which itself goes on top of Beyond the Walls
and Scene companions. The patch is made against tag `v4.0.0-preview.6` with those three applied.

## What is in this zip

- `extension/themes/wisteria/companion.chpet`: the messenger crow, an ordinary chpet v1 pack (3.2 MB)
- `wisteria-companion.patch`: the declaration and its tests (5 files, +19 / -6)
- `WISTERIA-CROW.md`: this note

## Apply

    unzip wisteria-crow.zip -d /path/to/canvas-harness   (adds extension/themes/wisteria/companion.chpet, this note and the patch)
    cd /path/to/canvas-harness
    git apply wisteria-companion.patch
    npm test

## The patch

`scene-themes.js` (`wisteria: 'companion.chpet'` in the `companions` map), `features.js` and `manifest.json` (the new
file in the wisteria lists), `tests/scene-manifest.test.cjs` (the wisteria folder now holds 12 files) and
`tests/scene-companion.test.cjs` (the crow passes the pack check with all eleven poses and is listed for the content
script; Wisteria Watch is the second scene with a companion).

## The crow

"Messenger crow": a blue-black crow with a rust-red cord tied round its neck, carrying a rolled letter, drawn in the
theme's soft cel style. Box 58 x 72, ground 68, facing right
(pets.js shows it 58 px wide at the medium size, 46 and 74 px at small and large). Every pose is an
animated WebP at 4x (232 x 288) that loops seamlessly; with motion off or reduced motion the extension shows the first
frame of the standing pose, as it does for any animated pack. The same file also works as an ordinary pack:
Make it yours -> More -> Add from a file, then Apply.

| pose | what it shows | type | size |
| --- | --- | --- | --- |
| `stand` | Standing: Breathes, blinks, cocks its head this way and that, flicks its tail and ruffles its wings now and then. | image/webp | 313 KB |
| `walk` | Walking: A crow's walk along the panel tops, one foot after the other, head bobbing with each step. | image/webp | 165 KB |
| `trot` | Hopping: Two-footed hops with a little bounce, when it hurries. | image/webp | 94 KB |
| `lie` | Settled: Settled down on its belly, feathers fluffed, breathing slowly. | image/webp | 283 KB |
| `sleep` | Asleep: Head sunk into its shoulders, eyes shut, slower breaths. | image/webp | 214 KB |
| `read` | Reading: Standing over a small open book, head tilting as it reads; it turns a page with its beak. | image/webp | 345 KB |
| `eat` | Eating: Pecks at a little pile of rice and swallows. | image/webp | 178 KB |
| `cheer` | Cheering: Spreads its wings wide, flaps and caws when you finish something. | image/webp | 334 KB |
| `flag` | Carrying the letter: Head up and proud, its rolled letter held in its beak. | image/webp | 180 KB |
| `fall` | Falling: Wings flung up and feathers ruffled, eyes wide, when it is dropped. | image/webp | 106 KB |
| `held` | Picked up: Held round its middle, feet dangling, swaying sheepishly. | image/webp | 242 KB |
