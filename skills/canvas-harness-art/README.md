# canvas-harness-art

A skill that teaches an AI assistant to draw course artwork for
[Canvas Harness](https://github.com/Flzsh/canvas-harness) in its house style: a living, hand-drawn banner with the
course name lettered into it, a sidebar icon, and a sidebar border. The output is three self-contained SVG files
that the Canvas Harness uploader accepts.

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
| `templates/` | Three working starting points: a scene with a rigged figure, an icon, a border. |
| `scripts/check.cjs` | Validates files with Canvas Harness's own validator and writes a preview page. |
| `scripts/walk.cjs` | Writes the keyframes for a walking figure. |
| `scripts/vendor/custom-art.js` | A copy of the validator from Canvas Harness 2.20.0 (MIT). Replace it when the extension changes. |
| `PROMPT.md` | The whole skill as one file, for assistants that cannot load a skill folder. |

## Using it

**With an assistant that supports skills** (Claude Code, Claude apps with skills): copy this folder to where your
skills live (for Claude Code, `~/.claude/skills/canvas-harness-art/`, or `.claude/skills/` inside a project), then ask:

> Make my Canvas Harness art for Marine Biology. This term we do tide-pool surveys, plankton tows, fish dissection
> and a kelp forest food web. My course colour is #2E6F73.

**With any other assistant:** open `PROMPT.md`, paste all of it into the chat, and add your request at the end.

Either way, say what your course actually does this term. That is what makes the picture yours.

## Checking and uploading

If you have Node.js 18 or newer:

```sh
node scripts/check.cjs path/to/your-art-folder
```

Every file should say `accepted`. Open the `preview.html` it writes to see each piece as the extension shows it.

Then, in Canvas Harness: **Customize workspace -> Course artwork**, choose the course, and Upload (or Paste SVG) for
the banner, the icon and the border. The banners are drawn for banner size **Large** or **Standard**, fit
**contain**, position **right**.

## Keeping it current

- `scripts/vendor/custom-art.js` is a copy of `extension/custom-art.js`. When Canvas Harness changes what it accepts,
  copy the new file over it (or run `check.cjs` with `--harness path/to/custom-art.js`) and update `references/format.md`.
- After editing any skill file, run `node scripts/build-prompt.cjs` to rebuild `PROMPT.md`.

## License

This skill is part of the Canvas Harness repository and is covered by its MIT license. `scripts/vendor/custom-art.js`
is a copy of the extension’s validator and carries the same notice in `scripts/vendor/`.
