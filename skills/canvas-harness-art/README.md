# canvas-harness-art

A skill that teaches an AI assistant to draw course artwork for
[Canvas Harness](https://github.com/Flzsh/canvas-harness) in its house style: a living, hand-drawn banner with the
course name lettered into it, a sidebar icon, and a sidebar border. The output is self-contained SVG that the Canvas
Harness uploader accepts, handed over as one **quick upload pack**: a block of text you paste into the extension
(or a `.chpack` file you drop on it) that already says which course and which slot each drawing is for.

The skill stands on its own. You do not need the extension's source code, and nothing in it edits the extension's
files, so it works with the GitHub installation. Chrome Web Store and Edge Add-ons listings are not published yet.

The assistant writes the SVG by hand. No image model is involved.

## What is in the folder

| Path | What it is |
|---|---|
| `SKILL.md` | The skill: what to deliver, the workflow, the rules that are never broken. |
| `references/style.md` | The look: line, wash, palette, the stick-figure cast, the lettered title, what to avoid. |
| `references/slots.md` | How the banner, icon and border are shown in the extension and how to compose each. |
| `references/format.md` | Exactly what the uploader accepts and refuses. |
| `references/animation.md` | The motion rules and the animation idioms that work in this format. |
| `references/checklist.md` | The review list to run before handing art over. |
| `references/quick-upload.md` | How the art is handed over: the quick upload pack, by paste or as a file. |
| `templates/` | Three working starting points: a scene with a rigged figure, an icon, a border. |
| `scripts/check.cjs` | Validates files with Canvas Harness's own validator and writes a preview page. |
| `scripts/pack.cjs` | Builds a quick upload pack from SVG files, checks one, or opens one back into files. |
| `scripts/quick-pack.js` | The reference reader and writer of the pack format (also usable inside the extension). |
| `scripts/test-pack.cjs` | Runs the pack format's test packs against a reader. |
| `quick-upload/SPEC.md` | The pack format and Quick upload's behaviour, for whoever implements the extension side. |
| `quick-upload/vectors/` | Test packs with the result every reader must give. |
| `scripts/walk.cjs` | Writes the keyframes for a walking figure. |
| `scripts/vendor/custom-art.js` | The validator from Canvas Harness 2.21.0 (GPL-3.0-only), usable without the extension source. Earlier MIT notices are retained. |
| `PROMPT.md` | The whole skill as one file, for assistants that cannot load a skill folder. |

## Using it

**With an assistant that supports skills** (Claude Code, Claude apps with skills): copy this folder to where your
skills live (for Claude Code, `~/.claude/skills/canvas-harness-art/`, or `.claude/skills/` inside a project), then ask:

> Make my Canvas Harness art for Marine Biology. This term we do tide-pool surveys, plankton tows, fish dissection
> and a kelp forest food web. My course colour is #2E6F73.

**With any other assistant:** open `PROMPT.md`, paste all of it into the chat, and add your request at the end.

Either way, say what your course actually does this term, and give the course's name the way Canvas shows it.
That is what makes the picture yours, and it is how Quick upload finds the course.

To change one thing later ("make the banner's boat red"), ask for just that; the assistant sends a pack with one
piece in it.

## Getting the art into Canvas Harness

Quick upload is implemented in the public **CH2.21.0** release.

**Quick upload (paste).** The assistant answers with one code block, the pack. Copy the whole block, open Canvas
Harness, go to **Customize workspace -> Quick upload**, paste and choose **Review pack**. Look over the previews,
warnings and course matches, choose courses for unmatched targets, leave unwanted pieces out, and apply the
selected artwork. Nothing changes before you confirm. For a banner with its course name drawn inside, choose Course artwork → Course title → Already drawn in banner after applying.

**Quick upload (file).** The same pack saved as a `.chpack` or `.txt` file: drop it on Quick upload or use
**Choose pack**, then review and apply it. Use this when someone sends you a pack, or when it is too long to copy
comfortably.

A pack can hold one piece or the art of every course you have, and it only changes what it names.
**Undo last pack** restores the most recent successful pack during the current workspace session, provided its
affected artwork and banner options have not changed. Pack format version 1 supports banners, icons and frames;
the lettered title is drawn inside the banner SVG.

**One at a time (older versions).** For an installed version without Quick upload, every
`<svg>...</svg>` in a pack is still an ordinary piece of artwork: in **Customize workspace -> Course artwork**,
choose the course and paste it into the "Paste SVG" box of the slot named on the line above it. Or run
`node scripts/pack.cjs --unpack your.chpack` and upload the files it writes.

The banners are drawn for banner size **Large** or **Standard**, fit **contain**, position **right**.

## Checking and packing (optional, needs Node.js 18 or newer)

```sh
node scripts/check.cjs path/to/your-art-folder          # or a .chpack file
```

Every piece should say `accepted`. Open the `preview.html` it writes to see each piece as the extension shows it.

```sh
node scripts/pack.cjs --course "Marine Biology" path/to/your-art-folder     # writes marine-biology.chpack
node scripts/pack.cjs --check marine-biology.chpack                         # reads it the way the extension will
```

## Keeping it current

- `scripts/vendor/custom-art.js` is a copy of `extension/custom-art.js`. When Canvas Harness changes what it accepts,
  copy the new file over it (or run `check.cjs` with `--harness path/to/custom-art.js`) and update `references/format.md`.
- After editing any skill file, run `node scripts/build-prompt.cjs` to rebuild `PROMPT.md`.
- The pack format is defined in `quick-upload/SPEC.md`. If it changes, change `scripts/quick-pack.js` and the test
  packs with it, and run `node scripts/test-pack.cjs`.

## License

This skill is part of the Canvas Harness repository and is covered by its GPL-3.0-only license.
The standalone validator in `scripts/vendor/custom-art.js` matches Canvas Harness 2.21.0
and uses GPL-3.0-only. The earlier 2.20.0 validator's MIT notice remains in
`scripts/vendor/LICENSE-canvas-harness.txt`; earlier copies retain their original permissions.
