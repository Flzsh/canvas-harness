# Make your own Canvas Harness packs

In **Make it yours → More → Add from a file**, choose `.chpack`, `.chkit`, `.chtheme`, `.chpet`, or `.chpreset`. The existing Quick Upload also accepts pasted `.chpack` text. Review a file before applying it. Files change local settings and assets; they never submit work to Canvas.

The Market uses these same codecs. Its first click asks for the optional `https://flzsh.github.io/*` permission. Declining still opens the website; installation requires that permission. Removing a pack restores its own changes and preserves later edits. Installing a preset from the Market saves it for review rather than applying it immediately.

## Check a file offline

No npm dependencies or network access are needed:

```sh
node scripts/check-pack.cjs my-theme.chtheme --preview preview.html
node scripts/skill-check.cjs --bundle check.cjs
node check.cjs my-theme.chtheme --preview preview.html
```

The second command builds a standalone checker from the extension's own validators, suitable for including with an authoring skill. Use the same `check.cjs` for every format. Invalid files produce field-specific diagnostics and no preview. The preview is isolated, self-contained HTML with no scripts or external resources. Node checks binary hashes, containers and size bounds; final browser import additionally decodes the media. A successful offline check does not prove browser playback.

## Shared rules

- Each portable file is at most 40 MB, encoded as UTF-8. The four JSON formats are strict: unknown fields are errors. `.chpack` retains its existing processing-instruction/SVG format.
- JSON binary assets use canonical base64 `data` and a lowercase hexadecimal SHA-256 of the original bytes in `sha256`. Use MIME `type`; URLs and executable fields are not accepted.
- SVG assets pass the existing `custom-art.js` validator: no scripts, event handlers, external references, or `data-*` attributes. Supported CSS animation and limited SMIL receive an animation-free copy. Artwork is rendered through isolated image elements.
- Keep author and artwork credits in the format's supported `by` or asset names. Retain the licences of any supplied art and fonts. The extension and checker retain the project's GPL and creator notices.
- Add from a file accepts pack files. Appearance artwork slots separately accept your own pictures and short videos by upload, drop or paste, processed only in your browser.

## Course artwork: `.chpack`

Use the retained [art authoring skill](../skills/canvas-harness-art/SKILL.md) and [Quick Upload specification](../skills/canvas-harness-art/quick-upload/SPEC.md). A pack can target the overview, every course, or a course chosen by the student, with banner, border, icon, or title SVG pieces. Keep course-specific names and private school data out of a shared pack; let the student select its destination. The checker uses the same parser and SVG validator as Quick Upload.

## Artwork kit: `.chkit`

A kit stores artwork and a small set of appearance choices together:

```json
{"version":1,"name":"Garden","assets":{},"accent":"forest","font":"serif","bannerSize":"standard","bannerFit":"contain","bannerPosition":"right","titlePlacement":"separate"}
```

All shown top-level fields are required. `name` is 1–40 printable characters. `assets` may contain `bannerArt`, `cardArt`, `backgroundArt`, `borderArt`, `titleArt`, and `iconArt`; each present entry requires `name`, `type`, `data`, and `sha256`. Banner, card and background assets may also carry `frame` data (`focus`, `zoom`, `fit`, `height`, and video `loop`/`still`) and a checked static `poster` for moving media. SVG works in every slot. A kit's banner, card and background assets may also contain PNG, WebP, JPEG, AVIF, GIF, MP4 or WebM bytes; a title asset may contain PNG or WebP. Raster/video bytes are decoded locally and stored as references. The placement fields are `contain|cover`, `left|center|right`, and `separate|banner`. Font is `system|humanist|serif`; size is `compact|standard|large`; accent is a public accent name or `#RRGGBB`.

## Dashboard theme: `.chtheme`

Start with a palette-only file and add artwork as needed:

```json
{"format":"chtheme","version":1,"name":"Garden","by":"Your name","colors":{"light":{"bg":"#ffffff","surface":"#ffffff","ink":"#111111","muted":"#444444","line":"#cccccc","accent":"#0055aa"}}}
```

Provide `light`, `dark`, or both. Each palette has exactly the six shown `#RRGGBB` colours. Ink needs 4.5:1 contrast on both background and surface; muted text and accent need 3:1 on surface. The validator names any failing pair.

Optional parts reference keys in an `assets` map whose entries contain exactly `type`, `data`, and `sha256`:

- `background`: `{ "asset":"sky", "still":"sky-still", "fit":"cover", "position":"top" }`. Fit can be `cover`, `contain`, or `tile`; position is `top`, `center`, or `bottom`.
- `banner`: the same shape, with `cover|contain` and `left|center|right`.
- `frames.panel` and `frames.card`: `{ "asset":"frame", "slice":[24,24,24,24] }`. The asset is SVG; opposing slices must fit inside its drawing box.
- `title`: `{ "asset":"font", "family":"Garden Serif", "weight":700, "license":"OFL-1.1" }`. Use WOFF2, a family name of at most 40 characters, weight 100–900, and `OFL-1.1`, `Apache-2.0`, or `CC0-1.0`.
- `icons`: up to six local image IDs. Use static raster images or validated SVG with its prepared still copy.

Banner and background layers may carry `focus: {x,y}` (0?1), `zoom` (1?4), `height` (`small|medium|tall`) and a video `loop: {start,end}` in seconds. A numeric `still` selects a video time; `stillAsset` identifies its separate static picture. Existing string `still` asset references remain valid. A background or banner video, GIF, or animated image requires a separate static still asset. All supplied assets must be used. Themes keep the student's light/dark choice and pause moving artwork in hidden/reduced-motion views. Removing or undoing a theme restores the previous appearance.

## Companion drawing: `.chpet`

```json
{"format":"chpet","version":1,"name":"Moth","size":[72,64],"ground":60,"faces":"right","poses":{"stand":"body","walk":"body","sleep":"body"},"assets":{"body":{"type":"image/svg+xml","data":"BASE64","sha256":"LOWERCASE_SHA256"}}}
```

Replace the two placeholders with actual SVG bytes and their hash. Size is a drawing box of 32–128 CSS pixels per side; ground lies within its height. Required poses are `stand`, `walk`, and `sleep`. Optional poses are `trot`, `lie`, `read`, `eat`, `cheer`, `flag`, `fall`, and `held`. Missing trot/lie fall back to walk/sleep; the others fall back to stand. Art may be SVG, PNG, WebP, or GIF. Raster poses are at most 2 MiB and at most four times the drawing box's dimensions; animated raster stills are derived from the stand pose. Installing changes the drawing while retaining Biscuit's existing name and behavior.

## Data add-ons and utilities: `.chpreset`

```json
{"format":"chpreset","version":1,"name":"My week","kind":"planner","data":{"days":{"mon":[{"title":"Organize notes","minutes":30,"at":"19:00"}]}}}
```

Choose one kind:

- `planner`: days `mon` through `sun`, at most eight blocks per day, each with a title and 10–240 minutes. `at` is optional `HH:MM`. The student selects the target week. Edited cards retain both their title/date and notes/checklist/progress when the preset is removed.
- `layout`: the public `workspace-arrange.js` tree under `workspaceLayout`, with optional `moduleSize` using `s`, `m`, or `l`. Use only known public modules; unavailable modules are skipped. Dynamic AI module IDs are rejected.
- `routines`: `{ "lines":["every sunday at 7pm plan my week"] }`, at most 20 recurring lines the public Biscuit parser already understands.
- `settings`: public appearance enums from `customization-model.js` plus supported theme/motion/font choices and optional `pet.coat`/`pet.harness`. Unknown settings and executable fields are errors.

To add executable functionality, contribute packaged code through the project's normal review process. A Market `feature` pack can enable only an already packaged public catalogue ID; it cannot install code. There is no separate Market feature switch.

## Back up installed files

Personal backups include installed theme, pet and preset documents, saved kits, their checked media bytes, and account-specific Market receipts. Restore checks the files and hashes before publishing them. It keeps the browser's current Full/Lite/Custom choice; those device choices are not part of an account backup. Removing a restored Market add-on still uses its own receipt and preserves later edits.

The complete backup is limited to 66.5 MB as JSON. If it would exceed that limit, export large kits separately before making a personal backup. Older backups without embedded media still restore on a device that has the referenced files; a new device needs those files too. Keep backups private: they can contain your notes, artwork and other account data.
