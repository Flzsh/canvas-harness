---
name: canvas-harness-art
description: Draw hand-drawn, animated SVG course artwork for Canvas Harness in its house style - a living banner with the course name lettered into it, a sidebar icon, and a sidebar row border - as self-contained SVG files that the Canvas Harness uploader accepts. Use when someone asks for a Canvas Harness (or Folio) banner, course header art, a lettered course title, a course icon, a sidebar border or frame, or "art for my class" in this ink-and-wash stick-figure style.
---

# Canvas Harness course art

Canvas Harness is a browser extension that replaces the Canvas LMS dashboard. Each course can carry its own
artwork: a **banner** across the course heading, an **icon** and a **border** for the course's row in the sidebar.
This skill makes those three pieces for one course at a time, in the extension's house style: warm ink-and-wash
drawings on bare paper, with small faceless stick figures doing the real work of the subject, the course name
lettered out of the subject's own material, and calm, purposeful animation.

You write the SVG yourself: by hand for small pieces, or with a small generator script of your own when a banner
has a hundred hand-wobbled paths. There is no image model in this workflow.

## What you deliver

| File | Slot | Size |
|---|---|---|
| `<course>-banner.svg` | Banner (title lettered into its left end) | `viewBox="0 0 1680 240"` |
| `<course>-icon.svg` | Icon | `viewBox="0 0 100 100"` |
| `<course>-border.svg` | Border | `viewBox="0 0 360 110"` |

Plus a short note: what the banner shows, what moves, what each colour of the title stands for, and how to upload
(Customize workspace -> Course artwork -> choose the course -> Upload or Paste SVG for each slot; banner size
"Large" or "Standard", fit "contain", position "right").

## Read before drawing

| Reference | When |
|---|---|
| `references/style.md` | Always. The hand, the palette, the cast, the title, what to avoid. |
| `references/slots.md` | Always. How each piece is shown and composed. |
| `references/format.md` | Always. What the uploader accepts and refuses. |
| `references/animation.md` | Before animating. The motion rules and the idioms that work in this format. |
| `references/checklist.md` | Before handing over. |
| `templates/*.svg` | Working starting points: a rigged figure in a scene, an icon, a border. |
| `scripts/hand.mjs` | Optional helpers for a generator script: hand-wobbled lines, loose washes, the figure with its joint rig. |
| `examples/` | Finished sets made with this skill, with their plans. Look at them for the level expected, not to copy. |

## Workflow

### 1. Ask (briefly)

Ask only what you cannot decide well yourself, in one message. Proceed on sensible defaults if the user does not answer.

1. The course name exactly as it should be lettered.
2. **What the course actually does this term:** units, experiments or projects, tools and instruments, texts,
   anything the class would recognise. This matters most. Generic knowledge of the subject is the fallback.
3. Their course colour (a hex or a word). Default: clay.
4. Which pieces (default: all three) and whether the name should be lettered into the banner (default: yes).
5. Light or dark theme (default: light), and anything they do not want shown.

Do not put a teacher's name, a school's name or other private details into the artwork unless asked.

### 2. Plan in writing

Before any SVG, write the plan (see "Planning a banner" in `slots.md`):

- 12 or more concrete things the course uses and does; the 3-5 set pieces you chose from them.
- The main event in one sentence, and for each actor: goal -> action -> visible result -> reset.
- A timeline table in seconds on one cycle (12 or 16 s), with the rest pose marked.
- Three title ideas, the one chosen, what each colour stands for.
- The icon's one thing and one action. The border's ink colour, corner signature, edge drawings and traveller.

If the user is there, show them the plan in a few lines and adjust. Otherwise go on.

### 3. Draw

Order: banner scene -> title -> icon -> border. Start from the templates' structure.

- Build back to front: ground, washes, paper shapes, ink, small solids, then figures and moving things in their own groups.
- Place each figure with one `translate(...) scale(1.3)` group around its ground point; rig its joints.
- Write the still picture first and make it right. Then add motion.
- Keep numbers to one decimal place. Ship without comments. A short `<title>` naming the picture is fine.
- If you can run code, a generator script keeps a big banner consistent (see `scripts/hand.mjs`); keep your working
  files in a subfolder so only the three finished SVGs sit in the folder you check.

### 4. Review

Go through `references/checklist.md` object by object. Read the animation at eight evenly spaced moments.
If you can render, look at the banner at 140 px tall and the icon at 22 px; fix what does not read.

### 5. Check

If you can run code:

```sh
node scripts/check.cjs <folder with the three files>
```

It runs Canvas Harness's own validator on each file, lints for the traps in this format, and writes `preview.html`
(every piece as the extension shows it, at the real sizes, animated and still, light and dark, and eight frozen
moments of every loop). Open it and look; the animated pictures take a few seconds to appear.
Every file must say `accepted`. If you cannot run code, check by hand against section A of the checklist.

### 6. Hand over

The three files, the note described above, and anything you were unsure of (a detail of the subject you guessed, a
choice the user may want changed). Offer one or two specific alternatives, not an open "anything else?".

## The rules that are never broken

1. **The banner shows what the course does.** No doors, walls, windows or other room shell. Not a pleasant scene
   that merely suggests the subject.
2. **Everything makes sense:** nameable, held up by something drawn, outlined whole, there for a reason.
3. **One image:** one ground, one light, groups that overlap and share, rhythm, no blank stretch.
4. **Hand-drawn:** nothing ruled, nothing identical, loose flat washes, bare paper, full-strength ink. No gradients,
   glows, blurs, shadows or gloss.
5. **One cast:** round faceless head, one-stroke torso, two-part arms and legs, a foot, one accessory each.
6. **The name is made of the subject,** clean, legible in a second, not black by default, never a font.
7. **Motion is drawn movement, never shaking.** Each actor has a goal, an action, a visible result and a rest.
   Nothing mirrored, no sliding feet, a seamless loop on one clock.
8. **The picture without animation is complete** (the format shows that copy to reduced-motion users).
9. **Icon:** one bold thing standing on the page. Never a circle, tile or badge round it.
10. **Border:** art only at the edges, its own deep ink, a corner signature, something that visibly travels.
11. **Colour means something,** and the course colour goes only on things that could honestly be any colour.
12. **Accurate and respectful:** a specialist would not wince; no stereotype of a people, culture or period.

## Scope notes

- This skill draws the house style on purpose. If the user wants a different look (photographic, flat corporate,
  pixel art), say this skill is not the tool, and only keep `references/format.md` so the file still uploads.
- "All courses" (the overview) takes the same three pieces: show the courses together as one place (a shared desk,
  a walk past all the subjects), with a greeting-neutral title or none.
- For a set of several courses, make every title a different recipe and every border a different ink and corner,
  and keep the cast, the ground and the palette common to all.
