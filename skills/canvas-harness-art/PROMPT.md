<!-- Built from the canvas-harness-art skill by scripts/build-prompt.cjs. Edit the skill files, not this one. -->

# Canvas Harness course art: one-file prompt

Paste everything below into your AI assistant, then add your request at the end, for example:

> Make my Canvas Harness art for **Marine Biology**. This term we do tide-pool surveys, plankton tows, fish
> dissection and a kelp forest food web. My course colour is #2E6F73. Light theme. All three pieces.

The assistant should answer with three SVG files (banner, icon, border) and a short note. Save each as a `.svg`
file and upload it in Canvas Harness: Customize workspace -> Course artwork.

Where the text below mentions files (`references/...`, `templates/...`, `scripts/...`), their content is included
further down in this same document; the script cannot be run from a pasted prompt, so check by hand against
section A of the checklist.

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

---

# Reference: the house style

A calm, warm, hand-made look: ink line and loose flat washes on bare ivory paper, like a page from a sketchbook
that has learned to move. Small people built from a few strokes do the real work of the subject among real,
whole objects. It should feel drawn by a person in one sitting, never assembled from clip-art, never ruled, never
glossy.

### 1. What a picture is about

**The banner demonstrates what the course does.** It is not a picture of a classroom.

- Show the subject's own actions, equipment, objects and ideas made visible, with people doing them.
- No room shell: no doors, door frames, walls, windows in a wall, skirting lines, clocks, notice boards, bins, coat
  rails, posters. No generic "school" props (apple, backpack, lockers).
- Buildings and landscape only when the subject is about them (architecture, history, geography, field work), and
  then as whole things.
- Be specific and correct. Ask what this course actually covers this term and draw that: the real apparatus, the
  real diagram, the real text, the real technique. A specialist in the subject should not wince. A formula, a
  spelling, a chemical structure, a period costume, a musical clef: get it right or leave it out.
- Depth beats coverage. Three or four things shown fully are better than eight hinted at.

### 2. It has to make sense

Look at every object and ask four questions. Anything that fails one is fixed or removed.

| Question | Passing | Failing |
|---|---|---|
| **What is it?** | A stranger names it at a glance. | A hint of an activity; three strokes standing for a building. |
| **What holds it up?** | Feet on the floor, a stand, legs, a bracket, a hand, a cord from something drawn. | A shelf on a wall that is not there; an awning with no posts; a lamp from a ceiling that is not drawn. |
| **Is its outline whole?** | Every side drawn; pen lifts of a unit or two. | A sheet outlined on two sides; a block whose end fades into streaks; an end hidden behind a tree to avoid drawing it. |
| **Why is it here?** | It belongs to what the course does. | Filler to occupy a gap. |

- Things partly hidden line up on both sides of what hides them.
- Things touch the ground and cast a small contact shadow.
- Which thing is in front is always obvious.

### 3. One image, not panels

- **One ground** for the full width: the same floor line, wash and shadows from edge to edge.
- **One light**, one eye level, one scale. The same amount of bare paper everywhere.
- **Things overlap and share.** Neighbouring groups share furniture, ground and light; something crosses every gap
  (a cable, a bench that runs on, a thrown thing, a look, a carried object).
- **Rhythm, not compartments.** Vary the size and spacing of groups. Avoid equal blocks at equal gaps (it reads as a
  row of museum exhibits), and avoid a tall thing standing in a gap like a divider.
- **No blank stretch** and no small isolated props standing in a line. Group things the way the world groups them:
  on, in, beside and behind one another.
- **Use the height.** Let some things be tall (a stand, a tree, a tower, a board on legs, a hanging thing with its
  support) so the upper half is not empty paper.
- **Fewer, bigger, deeper.** Set pieces large enough to read their workings. Demonstration scale is welcome: an
  oversized model the people work on (a giant instrument, a huge diagram they stand in front of).
- Give the place depth where it helps: a near edge, the acting figures, the large objects, and (outdoors) a pale far
  distance. Far things are smaller, paler and softer-edged, but still whole shapes.

### 4. The hand

All measurements are in drawing units of a banner 240 units tall. Canvas Harness shows a banner fairly small
(140 px tall by default), so everything is drawn a size bolder than you might expect.

#### Ink

`#141413`, round caps and round joins, `fill="none"`.

| What | Stroke width | Notes |
|---|---|---|
| Figures | 3-4 on screen (section 5: drawn in their own units, then scaled 1.3) | the boldest lines in the picture |
| Things people handle | 2.6-2.9, fully outlined | thin parts (strings, ticks, streams, needles) 1.8-2.0 |
| Furniture and ground (floor, bench edges, frames, legs) | 2.3-2.6 at `stroke-opacity` .75 | lighter than the people |
| Hatching and small marks | 1.6 at opacity .6 | |

- **Nothing is ruled.** A line is one `M` and relative curve segments. A "straight" edge 100 units long drifts 1-3
  units; an edge longer than about 110 is two or three strokes that overlap slightly. No two repeated things are
  identical: columns, tiles, fence posts, book spines each differ by a hair in width, lean and line.
- A closed outline overshoots its starting point by 3-6 units, like a pen coming round.
- Verticals are nearly vertical, parallels nearly parallel, corners rounded or slightly crossed.
- Never use `<rect>`, `<circle>`, `<ellipse>` or `<line>` for visible drawing: their perfection shows. Draw them as paths.

#### Wash

Flat colour, no gradients, no outlines of its own.

- A wash is a loose shape that does **not** follow its outline exactly: shift it 1-3 units, let it stop short of one
  corner, like a hand-coloured print. It always belongs to an outline and stays within a couple of units of it.
- A big block has a slightly wavy lower edge.
- Under every block a soft shadow blob (`#CFC2AC`, 6-8 units thick, lying on the ground just under the floor line, at
  about y 216-222); under every foot or leg on the floor a small one (about 16 x 6).
- The largest wash in a group may carry one lighter lobe on top (`#FAF9F5` at opacity .35) as a highlight.
- Small coloured marks are dabs: short round-cap strokes 4-5 wide, not little rectangles.
- **Leave most of the paper bare.** The background is the page itself.

#### Solids, hatching, grain

- A thin tapered sliver of ink (a lens 2-3 thick) under table tops, seats, shelves, and at a liquid's surface.
- Hatching: clusters of 2-5 short parallel strokes (7-12 long), all falling the same way, at the shaded end of a block.
  Roughly one cluster per 150 units of picture. Texture sits **inside** shapes and never replaces an edge.
- Grain: a sprinkle of tiny dots (zero-length round-cap strokes 1.8 wide, opacity .1) inside the large light washes.
  Leave it off dark washes (it does not show) and keep hatching off anything that carries a diagram (it reads as data).

#### Layer order (back to front)

ground wash and shadows -> washes -> paper-filled shapes (heads, sheets) -> ink -> small solids and dots -> grain.
Figures and anything that moves sit in their own groups above the things they pass in front of.

#### Palette

| Name | Hex | Use |
|---|---|---|
| paper | `#FAF9F5` | the page; fills of heads, sheets, highlights |
| ink | `#141413` | all line work |
| clay | `#D97757`, deep `#C96442` | the warm accent: one important thing per group |
| kraft | `#D4A27F` | wood |
| oat | `#E3DACC`, shadow `#CFC2AC` | benches, boards, stone, cloth; every shadow |
| manila | `#EBDBBC` | paper objects, labels, screens |
| sky | `#C9D6DF` | glass, metal, water |
| sage | `#B7C0A0`, deep `#7D8B5F` | plants |
| gold | `#E2B865` | light, brass, a plotted point |
| slate | `#6F7F8C` | roofs, steel, a dark board |
| lilac | `#C9B6CC` | one cool note (a rain cloud, a dye) |

- Keep to about six of these in one picture, plus **one subject accent** at most (a single extra hue used for one thing, warmed
  toward the palette).
- **When the subject is itself a colour scale** (a spectrum, a pH chart, a map key, star colours), that scale is one
  thing and may use its true hues, slightly softened: red `#C2503A`, orange `#DD8A4E`, gold `#E2B865`, green
  `#7D8B5F`, blue `#5F82BD`, violet `#A98FBC`. Keep them inside that one object.
- Light drawn on bare paper (a beam, a ray) needs body: a deeper gold (`#C99A3A`) or a line at least 4 wide.
- **Give the picture body.** It needs darks (ink, slate, deep sage), mids and lights, so that it does not read as beige on
  cream. At thumbnail size it should still have a clear light-and-dark pattern.
- **Colour means something.** Each colour stands for the material or thing it shows: copper is copper, the red wire
  is the live wire, water is sky-blue. No arbitrary coloured field behind things.
- **The course colour.** Canvas Harness cannot pass the user's course colour into an image, so bake it in. Ask the
  user for their colour and use it in two strengths:
  - the **key** colour, a soft wash: about 62% course colour + 38% manila, kept mid-light (default `#D79473`), on
    1-3 things that can honestly be any colour (a cover, a cloth, a flag, a sail, a scarf);
  - the **course colour itself**, near full strength, for at most one large object that could really be that colour
    (a painted board, a chart, a banner, a book cover). If the course colour happens to be the natural colour of the
    title's ground (a deep blue for a star chart, a green for a board), use it there.

  Never put either on something whose colour has a meaning of its own (fire, plants, wiring, a spectrum), and never
  as the continuation of a fixed-colour shape.
- No pair of dots near a rounded end: it reads as a face. (A real symbol that has them, such as a bass clef or a
  colon, is drawn correctly.)

#### Dark theme

The art sits on the page with a transparent background and black ink, so it is made for the light paper theme.
If the user works in the dark theme, give the artwork its own ground: one calm hand-edged paper shape
(`#FAF9F5` or oat) behind the whole drawing, slightly irregular, so the picture arrives on its own sheet.

### 5. The cast

Every figure in every picture is built the same way. Consistency is the point: if legs are two segments in one
figure, they are two segments in all of them.

**Draw the figure in its own units, around its own ground point (0,0), then place and scale it with one group:**
`<g transform="translate(640 214) scale(1.3)"> ...figure... </g>`. In a banner the scale is **1.3** (a figure stands
about 140 of the 240 units tall); far-away figures are smaller and paler. `templates/banner-rig.svg` contains the
figure, ready to copy, with its joints rigged.

| Part | Rule (figure units, before the 1.3 scale) |
|---|---|
| Head | 22-23 across, round, **no face**; outline 2.4 that overshoots its start; filled with paper. |
| Neck | None. The torso starts 4-6 units under the head. |
| Torso | **One stroke**, 3.2, about 37 long, slightly bowed. It leans; it never bends. |
| Arms | Both from one shoulder point 4 units below the torso top. **Upper arm 16 (3.0) + forearm 15 (2.6), with an elbow.** No hands: the thing held starts where the forearm ends. |
| Legs | Both from the torso's end. **Thigh 24 (3.0) + shin 18 (2.6), with a knee that always shows a little bend** pointing the way the figure faces. |
| Feet | One stroke 2.2 from the ankle (6-9 above the ground) forward to the toe, 9-10 long. It shows which way the figure faces. |
| Height | 105-112 overall; the hip is about 46 above the ground when standing. |
| Telling them apart | One accessory each: a bun, a ponytail, a tuft, a cap, a scarf (a wash knot with two tails, no ink), goggles, a hat for a period or trade. Never faces, never skin tones, never bodies with volume. |

- Each limb segment is its own stroke in its own group, so it can turn at its joint (see `animation.md`).
- Figures act with the whole body: lean into a push, crouch to look, reach with a bent arm, step back to judge.
- Everyone is the same height unless far away. Place the acting figures **in front of** the things they work on,
  where they read clearly, and make sure a hand really reaches what it touches.
- **What a figure can reach.** At scale 1.3 the shoulder is about 103 above the ground (y 111 when the ground is at
  214) and an arm reaches about 40: hands work between y 71 and y 151. Put what people handle at that height: on a
  bench about 55-65 high, on a post or stand, on a board on legs. A lower table top cannot be reached without
  leaning the whole figure or crouching it (both knees bent).
- **Looking into something** (an eyepiece, a microscope, a viewfinder): the head goes in front of the instrument and
  just touches it; lean the figure 4-8 degrees toward it. Dark arms over a dark object vanish: put a light wash or a
  paper edge behind them.
- Usually 2-5 figures in a banner. Fewer is fine when objects tell the story.
- Repeated props are one drawing reused (one stool, one flask, one book) with small differences.
- **Choose the view with the telling silhouette.** An upright piano from the side is a cupboard; a grand piano from
  the side is unmistakable. A microscope in profile, a globe on its stand, a telescope on a tripod: draw the view a
  child would draw.
- **Lettering inside the scene** (a label, a key name, a number on a board): keep it rare and short, at least 16
  units tall with a 2.4 stroke, drawn as paths. It will not read at Compact size, so the picture must not depend on it.

### 6. The lettered title

The course name is part of the artwork: the letters themselves are made of, written with, or grown out of the
subject. It stands at the left end of the banner.

- **The name is the artwork.** Not plain lettering with a prop beside it. Not a themed object next to a word.
  The strokes of the letters are the subject's own material.
- **One strong idea,** different for every course. Work out three candidates and choose. Examples of the kind of
  idea (use one if it really is the best idea for the course in front of you, but look for a better one first):
  - *Astronomy*: letters as constellations, bright stars joined by thin lines, on a deep-blue chart with a compass rose.
  - *Music Theory*: letters as stems and beams standing on a grand staff, a whole note for the O.
  - *Geography*: letters as stacked contour lines, the high ground washed, a river running through the baseline.
  - *Economics*: letters built of stacked coins and the crossing supply and demand curves.
  - *Woodworking*: letters cut from boards with visible dovetail joints and a pencil line where the next cut goes.
  - *Culinary Arts*: letters piped in icing on a marble slab, the piping bag finishing the last stroke.
  - *Marine Science*: letters as rope with knots, a buoy for a dot.
- **Clean.** Smooth continuous forms, one outline, flat colour. A few large telling elements, never a texture of
  tiny repeated blocks, never scattered small marks. If it looks busy at half size, simplify.
- **Meaningful detail.** It should reward a close look (correct fittings, joints, markings), organised so the name
  reads first and the detail unfolds after.
- **Legible in under a second** at 80 px tall. Decoration never breaks a letter's shape. Long names take two lines,
  or one large word and a smaller companion line. Numbers and prefixes ("II", "AP", "Honors") are part of the idea.
- **Test every substituted letter small.** A letter replaced by an object (a note for an I, a flask for an A) can
  turn the word into another word at 80 px. Look at it at that size; if it misreads, drop the substitution.
- **Not black by default.** Let the material give the letters colour and body: a coloured body with a darker pen
  edge, light letters on a dark ground the object really has, metal with one brushed gleam. Keep at least 3:1
  contrast between the letters and what is behind them. The course colour at full strength is a good letter colour;
  the soft key wash is too pale for lettering on paper.
- **Hand-drawn letterforms.** Each letter is its own slightly irregular drawing: no stem quite vertical, no two
  serifs alike. It must never be mistakable for a typeface. No `<text>`.
- **Tone fits the subject.** Playful for some courses, grave for others. A course about justice, memory or faith
  wants dignity (carved, cast, inked); a course about making things can be lively.
- If the title carries its own ground (a board, a slab, a chart), that object is whole, stands on the same floor
  line as the scene, and its colour is the colour that object really is. The ground may carry its own quiet markings
  behind the letters (staff lines, a grid, ruled lines); nothing from the scene goes behind them.
- One or two living details that belong to the idea (liquid running through, a point travelling along a curve, a
  gleam crossing metal, a leaf unfurling). Then rest.

### 7. What to avoid (each of these was tried and thrown out)

- Circles, tiles or badges around an icon or a glyph. Uniform line icons. Anything that reads as an app icon set.
- Glows, blur-ins, gradients, drop shadows, glossy highlights, particles: the "AI art" look.
- A flying chip or object crossing the screen for effect.
- Shaking, wobbling, constant swaying; mirrored flips for turns.
- A row of equal stations; small isolated props; blank stretches; half-drawn or floating things.
- Ruled architecture: identical columns, perfectly parallel edges, flat even fills, a title that looks like a font.
- Pale, thin, washed-out pictures: beige on cream with grey hairlines.
- Slapstick where the subject is serious; a pleasant scene that shows the setting of a subject but not the subject.
- A decorative object standing beside plain lettering as the "title".
- Stereotype or caricature of a people, a culture or a period. Use real architecture, objects and dress, drawn with respect.

---

# Reference: the three pieces

A course gets three files. They are a set: one subject, one palette, one hand.

| File | Slot in Canvas Harness | What it is |
|---|---|---|
| `<course>-banner.svg` | Banner | A long living picture of what the course does, with the course name lettered into its left end. |
| `<course>-icon.svg` | Icon | One small drawing for the course list. |
| `<course>-border.svg` | Border | The hand-drawn frame of the course's row in the sidebar. |

Upload them in **Customize workspace -> Course artwork** (choose the course, then Upload or Paste SVG for each slot).
"All courses" has the same three slots for the overview.

---

### Banner (`viewBox="0 0 1680 240"`)

#### How it is shown

| User's banner size | Height on screen | Width at "contain" | Screen px per unit |
|---|---|---|---|
| Compact | 80 px | 560 px | 0.33 |
| Standard (default) | 140 px | 980 px | 0.58 |
| Large | 220 px | 1,540 px | 0.92 |

- Default: **fit contain, aligned right**. The whole drawing shows, pushed to the right end of the heading; the page
  shows to its left. Design for this.
- Background: **transparent**. The paper is the page. Do not paint a sky or a wall across the whole box.
- If the user switches to **cover**, the drawing fills the heading's width and loses its top and bottom on wide
  headings (a 1,500 px heading at 140 px tall shows only the middle 157 of the 240 units). If they want cover, ask
  their usual window width and banner size and either compose inside the middle band (y 45-195) or use a wider box
  (`0 0 2400 240`) with the important things away from the ends.

#### Layout

```
x: 0        440                                                        1600  1680
   |  TITLE  |  ........ the scene: 3-5 groups, one ground ...........  | quiet |
y 214 --------------------------- one floor line -----------------------------
```

- **Ground line at y 214**, running the full width, with a pale ground wash under it (y 208-228). Figures' feet at
  207-213. Nothing important below y 226.
- **Title** occupies roughly x 16-440: the lettered name, at most about 420 units wide and up to 170 tall, standing
  on the same floor line. The scene's ground continues behind and past it; nothing else sits behind the letters.
- **Scene** from about x 420 to 1600. Tallest things reach up to about y 24. Keep 12 units clear at the top.
- **Quiet end:** the last 60-90 units at the right are ground only, so the picture ends calmly at the edge.
- At Standard size a figure is about 64 px tall and a 2-unit line is about 1.2 px. Nothing that matters should be
  smaller than 6 units, and the title should read at Compact (80 px tall).
- One main event runs through the scene (see `animation.md`). 2-5 figures. Up to about 40 moving parts. 12 or 16 s cycle.
- **Budget the width.** The scene has about 1,180 units. A figure takes about 50, a set piece 150-230. Three to five
  set pieces with their people fill it; if you come up short, make one piece larger and better told, never add filler.

#### Planning a banner (write this before drawing)

1. **List** 12 or more concrete things the course really uses and does (objects, instruments, diagrams, actions).
2. **Choose 3-5 set pieces** that draw well and can be shown working. Decide which are tall.
3. **Main event:** one sentence for what travels through the picture and what each piece does to it.
4. **Cast:** who stands where, each with goal -> action -> visible result -> reset, and one accessory.
5. **Timeline:** a table of seconds for every action on one cycle. Mark the rest pose.
6. **Title:** three ideas, the chosen one, what each colour stands for, its living detail.
7. **Overlaps:** what crosses each gap between groups; what is in front of what.

---

### Icon (`viewBox="0 0 100 100"`)

Shown at 40 x 40 px in the bottom-left corner of the course row in the sidebar, and at 22 x 22 px beside the course
name in assignment cards and headings.

- **One thing, standing on the page.** A single object from the course, or one small figure doing its most telling
  action. It has a short ground stroke and a small shadow under it so that it stands, not floats. Put that ground at
  the very bottom of the box (y 92-97): in the sidebar the icon stands on the bottom line of the row frame.
- **Never a circle, tile, badge or plate around it.** No background shape at all.
- **Bold.** Main ink strokes 6-7 units wide, round caps; secondary 4-5. Nothing that matters smaller than 10 units.
  An outlined wash needs room inside: with a 6-unit outline, a shape less than about 28 across closes up into a
  black blob, so outline small washes with 4 or leave them unoutlined.
  It must still be recognisable at 22 px: look at it that small before you finish.
- **Padding:** keep the drawing inside 6-94 on both axes; let it fill that area.
- **Colour:** ink, one or two washes from the palette, and the key (course) colour on one shape.
- **One action, then rest.** A 4-6 s cycle in which the thing does its one move once (a flag fills with wind, a page
  turns, a flask fizzes, a pencil draws its line) and then holds still for at least 2 s. At most 4 moving parts.
- It is not a crop of the banner. It may echo one object from it.

---

### Border (`viewBox="0 0 360 110"`)

The frame of the course row in the sidebar (or the course strip). The image is **stretched over the whole row**
(`preserveAspectRatio="none"`); the icon and the text of the row sit on top of it. A row is typically about
255 x 87 px in the sidebar and 225 x 84 px in the course strip, and can be as short as about 50 px or as tall as
about 140 px, so the image may be squeezed or pulled by up to about a third in either direction.

#### What is inside the row (measured in Canvas Harness 2.19 and 2.20; keep these areas clear)

```
 0        66                                                     360
 +---------+-------------------------------------------------------+ 0
 |  free   |  Course name                                   count  | 12
 |  corner |  Teacher or next thing due                            |
 |.........|  (text: x 72-336, y 12-82)                            | 82
 | [icon]  |                                                       |
 | 40x40   |............ free bottom strip ........................| 88
 +---------+-------------------------------------------------------+ 110
```

- **The icon stands in the bottom-left corner**, 40 x 40 px, on the bottom line of the frame (about x 7-65,
  y 55-109 in a typical row; higher up the box in a short row). Keep the bottom-left corner of the border a plain
  floor line for the icon to stand on.
- **The text** begins 52 px from the left (x 72 in the box) and starts about 11 px from the top.
- **Where border art can go:**
  - the **top strip**, up to about 9 units deep;
  - the **right strip**, up to about 9 units wide (the count sits in the top-right corner: keep that corner light);
  - the **bottom strip** to the right of the icon (x 72-352), up to about 18 units tall: the row keeps 20 px free there;
  - the **top-left corner above the icon** (x 4-64, y 6-38): room for one small drawing, the corner signature;
  - the corners themselves.
- The centre is empty and transparent: no wash across it.
- The frame leads to the icon: the bottom line runs under it, and one line or drawing of the frame may rise from
  where the icon stands (a stem, a cord, a trail of smoke), so icon and frame read as one drawing.

#### What a border is made of

- **The pen line.** One hand-inked line all the way round, slightly wavy, with rounded corners that are not quite
  alike and a small overshoot where it closes. It may have 2-4 short deliberate gaps where a drawing sits on it.
  Stroke 1.6-2, with `vector-effect="non-scaling-stroke"` on every stroke so the line keeps its weight when the box
  is stretched.
- **Its own ink colour.** Not black: a deep colour that belongs to the subject (a deep indigo, a leather brown, a
  jade, a lacquer red), at least 4:1 against the pale sidebar (`#F3F1EA`). One paint colour beside it for the washes.
- **8-12 small drawings on the edges and corners,** taken from the course: things that naturally run along a line or
  hang from it or stand on it (a scale, a ruler, a vine, a row of beads, a rail, a string of flags, a row of books,
  a wave, pegs, ticks). One **corner signature** that is unmistakably this subject.
- **Stretch-proof drawing.** Avoid perfect circles and anything that looks wrong when squeezed (faces of clocks,
  wheels, lettering). Leaves, drops, flags, ticks, curves, hatching and irregular shapes survive well.
- **Different from every other course at a glance:** colour, corner, and what runs along the top.
- **Alive, visibly.** Something travels a long way along an edge (at least a quarter of the top or bottom) every
  cycle: a bead along a wire, a drop down the side, a pulse along a trace, a boat along a wave, a bookmark sliding.
  One or two travellers, an 8-15 s cycle, with rests (a thing that truly never stops, like an orbit or a current, may
  run on without one). Small nudges of a unit or two do not count: at sidebar size they are invisible.
- It should look finished and calm when still.

#### The set

Icon and border are seen together in every row. Draw them as a pair: the same subject idea, the border's ink
colour chosen to sit well beside the icon's washes, and no repetition (if the icon is a flask, the border is not
six more flasks).

---

# Reference: the file format

Canvas Harness shows uploaded artwork as an **isolated image**: the SVG is validated, stored, and rendered through an
`<img>` (a data URL). It is never injected into the page. Three consequences drive everything below:

1. **Nothing from the page reaches the drawing.** No page fonts, no CSS variables, no `currentColor`, no course colour,
   no theme. Every colour is written into the file.
2. **No scripts and no outside resources.** Only self-contained CSS (`<style>`, `@keyframes`) and SMIL can animate.
3. **A static copy is made automatically** for people who use reduced motion or switch animation off: every animation
   is stripped and what remains is shown. So the drawing with all animation removed must be the complete picture
   (see "The rest pose" in `animation.md`).

Checked against Canvas Harness 2.20.0 (`extension/custom-art.js`, unchanged since 2.18.1). `scripts/check.cjs` runs that same validator.

### The three slots

| Slot | Recommended `viewBox` | How it is shown | Notes |
|---|---|---|---|
| **Banner** (with the lettered title inside it) | `0 0 1680 240` | A strip across the course heading, 80, 140 (default) or 220 px tall depending on the user's banner size. Default fit is **contain, aligned right**; the user can switch to **cover** and to left/centre. | Transparent background. See `slots.md` for the safe areas. |
| **Icon** | `0 0 100 100` | 40 x 40 px in the bottom-left corner of the course row, 22 x 22 px beside the course name elsewhere. | Must read at 22 px. |
| **Border** | `0 0 360 110` | Stretched over the whole course row (`preserveAspectRatio="none"`); the row's icon and text sit in the middle. A row is typically about 255 x 87 px. | Hollow and transparent in the middle: art only on the edges and corners. |

"All courses" (the overview) has its own banner, icon and border slots; treat it as one more course.

### Hard limits

- 256 KiB per file (raw and after normalising); 2 MiB for all of a user's artwork together. Aim far lower:
  banner <= 70 KB, icon <= 6 KB, border <= 14 KB.
- At most 4,096 elements, nesting at most 64 deep, at most 60 attributes on one element.
- One `d` attribute holds at most 8,192 numbers and letters. Split very long paths.
- All CSS together at most 64 KiB; at most 16 `<style>` elements.
- XML 1.0, UTF-8, one `<svg>` root with `xmlns="http://www.w3.org/2000/svg"` and a `viewBox`.

### Allowed elements

`svg g defs symbol use path rect circle ellipse line polyline polygon linearGradient radialGradient stop clipPath mask
pattern filter feGaussianBlur feOffset feBlend feComposite feColorMatrix feFlood feMerge feMergeNode feMorphology
feTurbulence feDisplacementMap feDropShadow title desc style text tspan textPath animate animateTransform animateMotion
set`

Not allowed (the upload is refused): `script`, `image`, `foreignObject`, `a`, `marker`, `switch`, `view`, nested `svg`,
anything with a namespace prefix (`inkscape:`, `sodipodi:`, `xlink:` other than `xlink:href`), `<!DOCTYPE>`, entities,
processing instructions.

House style uses only `svg g path style` plus, when needed, `defs clipPath animate animateTransform animateMotion`.
Avoid `text` (no fonts reach the image; the lettering is drawn), avoid filters (slow, and not the look).

### Allowed attributes

On every drawable element: `id class style transform opacity fill fill-rule fill-opacity stroke stroke-opacity
stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset color visibility
display filter clip-path clip-rule mask vector-effect paint-order shape-rendering overflow pointer-events`
plus the element's own geometry (`d`, `pathLength`, `x`, `y`, `width`, `height`, `rx`, `ry`, `cx`, `cy`, `r`,
`x1`..`y2`, `points`).

**Any other attribute is refused**, including every `data-*` attribute, `aria-*`, `role`, `tabindex`, `xml:id` and
event handlers (`onclick`...). Class names are letters, digits, `_` and `-`, starting with a letter or `_`.
Ids start with a letter or `_`. `href` may only be a local `#id`.

### Allowed CSS

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

### Allowed SMIL

- `animate` may target only: `x y cx cy r rx ry width height x1 x2 y1 y2 opacity fill stroke fill-opacity
  stroke-opacity stroke-width stroke-dashoffset stop-color stop-opacity`.
  **`d` cannot be animated**: there is no path morphing in this format. Movement comes from transforms, travel along a
  path, drawing-on, and switching between drawn poses (see `animation.md`).
- `animateTransform` (types `translate scale rotate skewX skewY`), `animateMotion` (with `path`, `rotate`,
  `keyPoints`), `set`.
- Clock values are plain times only: `begin="2.5s"`, `dur="12s"`, `repeatCount="indefinite"`. Event and sync-base
  values (`begin="click"`, `begin="a.end"`) are refused.
- `calcMode` `linear | discrete | paced | spline`; `fill` `freeze | remove`.

### What gets a file refused most often

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

### Writing compact paths

One decimal place is enough at these sizes. Prefer one absolute `M` followed by relative `c`/`q`/`l` segments. Put
strokes that share weight and colour in one `path` with several `M` sub-paths. Whitespace and XML comments are
allowed but count toward the size; ship without comments.

---

# Reference: animation

The pictures are alive the way a short hand-drawn film is alive: someone does something, it has a result, and then
the picture rests. They are not alive the way a screensaver is.

### The rules

1. **More motion means more movement, not more shaking.** No line boil, no wobble, no idle sway, bob, pulse or
   breathing on people, hair, cables or props. Whoever is not acting is perfectly still.
2. **Continuous motion only where the real thing never stops:** a flame, vapour, running water, bubbles, a
   pendulum, a turning wheel, smoke. Everything else acts, then rests.
3. **Every action has four beats: anticipation, action, settle, rest.** A small move the other way first, the
   move, a slight overshoot that comes back, then a hold of at least half a second. Most parts rest for most of
   the cycle.
4. **Every actor has a story you can say in one sentence:** goal, action, visible result, plausible reset.
   "She tips the jug, the trough fills, the wheel begins to turn, then she sets the jug down." If you cannot
   write the sentence, redesign the action. Nobody is busy doing nothing.
5. **Cause and effect cross the picture.** One station's result starts the next station's action, on one timeline.
   The banner has one main event the eye can follow, usually travelling left to right.
6. **Never mirror.** No negative `scale` to turn a figure round. Prefer stories in which a figure keeps facing its
   work. If someone must turn, draw the in-between poses and switch them (see "Pose switching").
7. **Feet that are on the ground stay on the ground.** A standing foot does not slide.
8. **The loop is seamless.** Every animated property returns to its rest value by the end of the cycle, and every
   animation's duration divides the cycle evenly.
9. **Real things move the real way.** Curves that claim to be parabolas are parabolas; a pendulum's swing, a
   bouncing ball, gears that mesh at the right ratio, a level that rises when something is lowered into it.

### The rest pose (the rule that the format enforces)

Canvas Harness also shows a **static copy with every animation removed** (reduced motion, or animation switched off).
So the drawing as written, ignoring all `animation`, `transition`, `@keyframes` and SMIL elements, must be the
finished picture:

- Never give an element a base `opacity="0"`, `visibility="hidden"`, or a hiding `stroke-dashoffset` and rely on
  animation to reveal it.
- Things that appear during the loop are **visible at rest**; the loop takes them away early, then brings them back:
  `0%,4% {shown}  8%,24% {hidden}  58%,100% {shown}`.
- The rest pose is the most telling moment of the story (the pour, the reach, the finished drawing), not a neutral stand.
- Every `@keyframes` begins and ends (`0%` and `100%`) at the rest value.

### One clock

Pick one cycle for the file: **12 s or 16 s** for a banner, **4-6 s** for an icon, **8-15 s** for a border.
Give every animation that duration, or a whole fraction of it (6, 4, 3, 2 s for a 12 s cycle), so the picture as a
whole repeats exactly. Stagger actions with keyframe percentages, not with `animation-delay` (a delay shifts the
loop and breaks the shared rest moment). All CSS animations in one file start together when the image loads.

```css
/* 12 s cycle. Percentages: 1% = 0.12 s. Repeated keys are holds. */
.arm{transform-origin:602px 135px;animation:arm 12s infinite}
@keyframes arm{
  0%,8%   {transform:rotate(0deg)}                     /* rest */
  12%     {transform:rotate(6deg);                     /* anticipation: a little the other way */
           animation-timing-function:cubic-bezier(.3,0,.2,1)}
  22%,62% {transform:rotate(-74deg)}                   /* action, then hold */
  66%     {transform:rotate(-78deg)}                   /* small follow-through */
  76%,100%{transform:rotate(0deg)}                     /* settle and rest */
}
```

`animation-timing-function` inside a keyframe sets the easing of the segment that starts there. Use soft easings
(`cubic-bezier(.3,0,.2,1)`, `ease-in-out`); `linear` for travel at constant speed and for anything driven by
physics you computed yourself; `steps(1)` only where a jump is wanted (a light, a counter, a pose switch).

### The idioms that work in this format

There is **no path morphing** (`d` cannot be animated). All movement is built from these.

#### 1. Joints: a figure is a puppet of rigid parts

Each limb segment is its own stroke inside nested groups; a group rotates about its joint.
`transform-origin` in px is in the drawing's own coordinates (the default `transform-box` for SVG is the view box),
so write the joint's coordinates as drawn. Nested groups carry their children with them: the forearm group sits
inside the upper-arm group and keeps its own origin at the elbow.

```svg
<g class="arm">                                  <!-- origin: shoulder -->
  <path d="M602 135c1.6 5 3 10.2 4.2 15.4"/>     <!-- upper arm -->
  <g class="fore">                               <!-- origin: elbow -->
    <path d="M606.2 150.4c3 4.6 5.6 9.2 8 14"/>  <!-- forearm -->
    <path d="..."/>                              <!-- what the hand holds rides along -->
  </g>
</g>
```

- Two joints moving together read as a drawn in-between; one rigid swing reads as a clock hand. Bend the elbow
  as the shoulder turns, and give the forearm a slightly different timing (it arrives a beat later).
- A lean is the whole figure rotating 3-6 degrees about the hips or the feet. A nod is the head group, 5-8 degrees.
- **Do not put a `transform` attribute on an element that CSS also transforms** (the CSS replaces it). Place things
  with coordinates, or wrap them in an outer group that carries the static transform.
- Inside a placed figure (`<g transform="translate(...) scale(1.3)">`) the `transform-origin` values are in the
  figure's own units, the same numbers its paths are written in.
- **Angles for nested joints.** The upper arm's key is its own turn from rest. The forearm's key is relative to the
  upper arm: (forearm direction - upper-arm direction) at the pose, minus the same difference at rest.
- To aim a hand at a point, solve the two-bone triangle (upper 16, forearm 15): `scripts/hand.mjs` has `ik()` and a
  `figure()` that writes the rig and its keyframes from target points.
- **A figure facing the other way** is drawn with its x values negated in its own numbers, never with a mirroring
  transform. Its elbows and knees then bend the other way, and every rotation in its keyframes changes sign.
- **A seated figure:** hip about 30 above the ground (figure units), thighs 72-79 degrees forward of straight down,
  shins near vertical, on a seat whose top is about 29 figure units above the ground (near y 176 in the banner when
  the ground is at 214).
- **A rest pose that leans** (someone bent to an eyepiece, pushing a cart): put the lean as a static `rotate()` in the
  placing group's `transform`, and animate an inner group whose rest value is 0. If the lean lives only in keyframes,
  the still copy stands upright with its hands off the tool.
- **A held tool** (a pointer, a baton, a rod) is a third joint: its key is (tool direction - forearm direction) at
  the pose, minus the same at rest.
- When a hand must follow something along a path, sample: compute arm, forearm and thing from **one** eased
  parameter at 8-12 moments and write those as linear keyframes. Parts eased separately drift apart mid-move.
  A target closer to the shoulder than the difference of the two bones folds the arm through the body: go round it.
- `templates/banner-rig.svg` is a working figure with this rig.

#### 2. Travel: move a whole thing

`transform:translate(...)` in keyframes for straight travel (a cart, a ball on a table, a page pushed along a bench).
For travel along a curve there are two ways.

**SMIL, which follows a path exactly.** Draw the thing **at its rest position** and give the path **relative to
that position, starting at `M0 0`**. (The still copy removes every SMIL element. A thing drawn at the origin and
moved into place by `animateMotion` would sit in the top-left corner of the still picture.)

```svg
<g><path d="M240 120..."/> <!-- the bee, drawn where it rests -->
  <animateMotion dur="12s" repeatCount="indefinite" calcMode="linear"
    keyPoints="0;0;1;1;0;0" keyTimes="0;.1;.4;.6;.9;1"
    path="M0 0c40-30 90-30 130 0"/></g>
```

`keyPoints`/`keyTimes` give holds and the return trip.

**CSS, sampled.** Compute the positions yourself (an orbit, a parabola, a pendulum) and write them as `translate`
keyframes with `linear` timing: 20-40 samples for a full curve. This is the way to get real physics (a planet that
speeds up near its sun, a ball that slows at the top of its arc).

Rolling things turn by distance travelled: degrees = distance / (pi x diameter) x 360.

To keep a **hand on a moving thing**, key the arm and the thing at the same percentages with the same timing
functions, and add a key at the midpoint of each move. Angles and positions interpolate differently, so without the
midpoint key the hand drifts off what it holds.

#### 3. Drawing on: a line that writes itself

```svg
<path class="chalk" pathLength="1" d="M676 164c22-30 40-44 62-40..."/>
```
```css
.chalk{stroke-dasharray:1;animation:chalk 12s infinite}
@keyframes chalk{0%,4%{stroke-dashoffset:0} 8%,24%{stroke-dashoffset:1} 58%,100%{stroke-dashoffset:0}}
```

`pathLength="1"` makes the dash maths the same for every path. At rest the offset is 0, so the static copy shows
the whole line. Use it for a graph being plotted, handwriting, a route on a map, a thread, a growing vine, and for
the title lettering being retraced.

- **One path per pen stroke.** The dash pattern starts again on every sub-path, so a path with several sub-paths
  draws them all at once, not one after another. To write strokes in order, give each stroke its own `<path>` and
  its own keyframes (the second stroke starts when the first ends).
- A round cap leaves a dot at the start of a hidden line. To remove it, also key `opacity:0` while the line is
  hidden and begin the draw at offset .96 instead of 1.
- **Never wipe a whole letter of the title:** for half a second the word would be misspelt. Keep a pale copy of the
  letter strokes underneath (the same path at about 40% opacity) and redraw only the bright line on top of it.

#### 4. Fill, level, grow: scale from an edge

A liquid level, a bar in a chart, a thermometer, a growing shadow: scale the shape from its base.

```css
.level{transform-origin:412px 196px;animation:fill 12s infinite}   /* origin on the bottom edge */
@keyframes fill{0%,10%{transform:scale(1,1)} 20%,40%{transform:scale(1,.25)} 70%,100%{transform:scale(1,1)}}
```

Keep the outline outside the scaled group, so glass does not stretch with its contents.

#### 5. Appear, light up, change state

Opacity keyframes for a lamp coming on, a tick being added, a speech bubble, a point plotted. A bubble or a mark
should **grow** in, not fade: scale it from the point where it comes from (`transform-origin` at the speaker's
mouth, the pen tip). A colour change is an `opacity` cross-fade between two stacked shapes.

#### 6. Pose switching: drawn in-betweens

When a part must change shape (a turn, a hand opening, a wing, a page turning, a mask being put on), draw the poses
as separate groups in the same place and show one at a time.

- The **rest pose** is drawn normally. Its keyframes take it to `opacity:0` while another pose is showing.
- Every **other pose** carries the attribute `opacity="0"` and is raised to 1 only inside its keyframes. The
  attribute survives in the static copy, so the extra poses stay hidden there.
- Use `steps(1)` so poses swap, not cross-fade.

```svg
<g class="pA"> ...rest pose... </g>
<g class="pB" opacity="0"> ...in-between... </g>
<g class="pC" opacity="0"> ...far pose... </g>
```
```css
.pA,.pB,.pC{animation-duration:12s;animation-timing-function:steps(1);animation-iteration-count:infinite}
.pA{animation-name:pa}.pB{animation-name:pb}.pC{animation-name:pc}
@keyframes pa{0%,30%{opacity:1}30.1%,60%{opacity:0}60.1%,100%{opacity:1}}
@keyframes pb{0%,30%{opacity:0}30.1%,33%{opacity:1}33.1%,57%{opacity:0}57.1%,60%{opacity:1}60.1%,100%{opacity:0}}
@keyframes pc{0%,33%{opacity:0}33.1%,57%{opacity:1}57.1%,100%{opacity:0}}
```

Three to five poses, 0.2-0.3 s apart, read as a drawn turn. Combine with a joint rotation inside each pose for
smoothness.

The same trick puts a moving thing **in front of or behind** something at different times (a planet passing behind
its sun): two copies with the same movement, one drawn before the object and one after it, swapped with `steps(1)`
opacity. The copy that is hidden at rest carries `opacity="0"`.

#### 7. A walk (use sparingly)

A walk is the hardest thing to make convincing with rigid parts, and a figure that walks away has to come back.
Prefer stories told in place, a single step, or a **thing** that travels (pushed along a bench, rolled, thrown,
passed from hand to hand) while the people stay at their work.

If a figure must walk:

- A step is 20 units and 0.6 s. The body moves at constant speed, sinks 1 unit at the down pose and rises 1 at the
  up pose. Each leg is a thigh group with a shin group inside it; four poses per step (contact, down, passing, up).
  The planted leg is keyed so that its foot stays where it landed while the hip passes over it.
- `scripts/walk.cjs` writes those keyframes for the house figure (two-bone geometry, planted foot fixed):
  `node scripts/walk.cjs --cycle 12 --start 2 --steps 6`. Without the script, key the poses by hand and check
  them frame by frame: a foot on the floor must not slide more than a unit or two.
- A walk begins and ends in the standing pose.
- **The reset must be believable.** A figure cannot jump back to where it started in view. Let it walk out behind
  something (a screen, a tree, the edge of a large object) and a walker come in from behind something at the other
  end, or keep the walk short and give the figure a drawn turn (pose switching) and a walk back.

### Performance

The image is rasterised as it animates. Keep it light:

- Animate `transform` and `opacity` wherever possible; `stroke-dashoffset` for drawing on. Do not animate filters,
  gradients or large fills.
- At most about 40 animated elements (elements that carry an animation) in a banner, 4 in an icon, 8 in a border.
- No `filter` at all in the house style.
- Small moving things over still large things. Never move the whole scene.

### Reading your own animation

Before you call it done, write out (or render) the picture at eight evenly spaced times of the cycle and check each:

- Is anything half-hidden, detached from the hand that holds it, or passing through something?
- Does the story read in order without captions?
- At t = 0 and at the end, is it the identical, complete rest pose?
- With all animation removed, is the picture finished and sensible?

`scripts/check.cjs` writes a preview page that shows eight frozen moments of every loop. The animated pictures on
that page play from the moment it loads, so a screenshot of them can catch the reset phase: judge from the frozen row.

---

# Reference: review checklist

Go through this before handing anything over. Fix what fails; do not explain it away.

### A. Will it upload?

- [ ] One `<svg>` root with `xmlns` and a `viewBox` (banner 1680x240, icon 100x100, border 360x110).
- [ ] Only allowed elements; no `data-*`, `aria-*`, `role`, namespaced attributes, scripts, images, links, markers.
- [ ] No `var()`, no outside `url()`, no `@import`/`@font-face`, no `offset-path`, no animated `d`.
- [ ] SMIL clocks are plain times; no `begin="x.end"` or events.
- [ ] Under 256 KiB (aim: banner 70 KB, icon 6 KB, border 14 KB).
- [ ] `node scripts/check.cjs <folder>` says `accepted` for every file, with no `!` warnings left unexplained.

### B. Is the still picture right?

Imagine every animation removed (this is what reduced-motion users see).

- [ ] The picture is complete: nothing missing, nothing that should be hidden is showing.
- [ ] It shows the most telling moment, not a neutral pause.
- [ ] Every `@keyframes` starts and ends on the rest value; every duration divides the cycle.

### C. Does it show the course?

- [ ] A person who takes this course would say "that is what we do".
- [ ] Everything is correct for the subject (formulae, spellings, instruments, period, notation).
- [ ] No room shell: no doors, walls, windows, clocks, notice boards, bins.
- [ ] Three to five things shown fully, not eight hinted at.

### D. Does each object make sense? (go object by object)

- [ ] A stranger can name it.
- [ ] Something drawn holds it up.
- [ ] Its outline is whole; no faded or hidden ends.
- [ ] It belongs to the course; it is not filler.

### E. Is it one image?

- [ ] One ground line and ground wash from edge to edge; one light; one scale.
- [ ] Groups overlap or share something; something crosses every gap.
- [ ] No equal blocks at equal spacing; no blank stretch; no isolated little props in a row.
- [ ] The upper half is used by something tall and supported.
- [ ] At a quarter of its size it still has a clear pattern of darks and lights (not beige on cream).

### F. Is it the hand?

- [ ] No ruled lines, no perfect circles or rectangles, no two repeated things identical.
- [ ] Washes sit loosely against their outlines; most of the paper is bare.
- [ ] Figures follow the cast model: round faceless head, one-stroke torso, two-part arms and legs, a foot, one accessory.
- [ ] Full-strength ink on near things; only far things are pale.
- [ ] No gradients, glows, blurs, drop shadows, glossy highlights.

### G. The title

- [ ] The letters are made of the subject; nothing merely stands beside plain lettering.
- [ ] The name reads in under a second at 80 px tall.
- [ ] Clean: no texture of tiny repeated pieces, no scattered small marks.
- [ ] Each colour stands for something; the letters are not black by default.
- [ ] Hand-drawn letterforms that could not be mistaken for a font. No `<text>`.
- [ ] Its tone fits the subject.

### H. The motion

- [ ] No shaking, wobble, idle sway or pulse. Whoever is not acting is still.
- [ ] Every actor: goal, action, visible result, reset. One main event crosses the banner.
- [ ] Anticipation, action, settle, rest; holds of at least half a second.
- [ ] Nothing mirrored. Planted feet do not slide. Hands stay on what they hold.
- [ ] Read at eight evenly spaced moments: nothing detached, half-hidden or passing through something.
- [ ] Continuous motion only on things that never stop.

### I. Icon and border

- [ ] Icon: one thing standing on the page, no circle or tile round it, recognisable at 22 px, one action then rest.
- [ ] Border: art only on the edges and corners; the middle is empty; a plain floor line bottom-left for the icon;
      `vector-effect="non-scaling-stroke"` on strokes.
- [ ] Border: its own deep ink colour; a corner signature; something travels a long way along an edge each cycle.
- [ ] Border still looks right on a 255 x 56 row and a 300 x 132 row, with the icon standing in its bottom-left corner.
- [ ] Icon and border look like a pair, and unlike any other course's.

### J. Respect

- [ ] People, cultures and periods are drawn with real, specific detail and without caricature.
- [ ] Nothing private about the user or their school appears in the artwork unless they asked for it.

---

# Templates

## templates/banner-rig.svg (ground, a rigged figure, a working object)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1680 240">
<style>
.i{fill:none;stroke:#141413;stroke-linecap:round;stroke-linejoin:round}
.f{fill:none;stroke:#141413;stroke-opacity:.75;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.h{fill:#FAF9F5;stroke:#141413;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.plot{fill:none;stroke:#C96442;stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;animation:plot 12s infinite}
/* one shared cycle: every animation is 12s (or 6s, 4s, 3s), so the whole picture loops as one */
.arm{transform-origin:2px -79px;animation:arm 12s infinite}
.fore{transform-origin:6.2px -63.6px;animation:fore 12s infinite}
.head{transform-origin:2px -87px;animation:look 12s infinite}
.lamp{transform-origin:742px 76px;animation:lamp 12s infinite}
.flame{transform-origin:476px 163px;animation:flame 3s ease-in-out infinite}
/* anticipation, action, settle, rest. Repeated keys are holds. 0% and 100% are the rest pose. */
@keyframes arm{0%,8%{transform:rotate(0deg)}12%{transform:rotate(6deg);animation-timing-function:cubic-bezier(.3,0,.2,1)}22%,60%{transform:rotate(-60deg)}64%{transform:rotate(-63deg)}76%,100%{transform:rotate(0deg)}}
@keyframes fore{0%,8%{transform:rotate(0deg)}12%{transform:rotate(-8deg);animation-timing-function:cubic-bezier(.3,0,.2,1)}22%{transform:rotate(-46deg)}26%,60%{transform:rotate(-40deg)}76%,100%{transform:rotate(0deg)}}
@keyframes look{0%,24%{transform:rotate(0deg)}30%,58%{transform:rotate(7deg)}66%,100%{transform:rotate(0deg)}}
/* effect follows cause: she presses the button at 22%, the lamp comes on, then the line is plotted */
@keyframes lamp{0%,22%{transform:scale(1)}25%{transform:scale(1.5)}30%,100%{transform:scale(1)}}
/* the line is complete at rest (offset 0). The loop wipes it early, then it is drawn again. */
@keyframes plot{0%,4%{stroke-dashoffset:0}8%,26%{stroke-dashoffset:1;animation-timing-function:cubic-bezier(.3,0,.3,1)}58%,100%{stroke-dashoffset:0}}
@keyframes flame{0%,100%{transform:scale(1,1)}50%{transform:scale(.92,1.12)}}
</style>
<g class="ground"><path d="M0 211c220-3 460-2 700-3 300-1 640 1 980 2v16c-360 4-700 3-1010 3-240 0-460 1-670 0z" fill="#E3DACC" opacity=".55"/><path d="M430 219c50 2 120 1 170 0M610 220c20 1 44 1 62 0M700 218c40 2 100 1 150-1" fill="none" stroke="#CFC2AC" stroke-width="5" stroke-linecap="round" opacity=".8"/></g>
<g class="wash"><path d="M650 88c62-3 126-2 188 1 2 33 1 66-1 98-64 3-124 2-186-1-2-33-2-65-1-98z" fill="#EBDBBC"/><path d="M666 94c9-1 18-1 27 0l-1 22c-9 1-17 1-26 0z" fill="#D4A27F"/><path d="M466 176c8-1 14-1 21 0l-2 33c-6 1-12 1-18 0z" fill="#D4A27F"/></g>
<g class="ink"><path class="f" d="M0 214c180-2 380-1 560-2M556 213c220-2 440-1 640-1M1192 213c170 1 330 0 488 1"/><path class="f" d="M646 84c64-3 130-2 194 1M840 85c2 35 1 69-1 104M839 189c-64 3-128 2-192-1M647 188c-2-35-2-69-1-104M668 189l-10 24M818 190l9 23M664 92c10-1 20-1 30 0M694 92l-1 25M693 117c-10 1-19 1-28 0M665 117l-1-25M466 175c8-1 15-1 22 0M467 176l1 37M486 176l-1 37M742 84v-6"/><path class="plot" pathLength="1" d="M708 166c20-30 36-44 56-40 18 4 26 24 46 20 8-2 14-8 18-16"/></g>
<g class="solid"><path d="M675 104c2-3 6-3 8 0 2 3 0 7-4 7s-6-4-4-7z" fill="#C96442"/><g class="lamp"><path d="M737 76c0-4 2-6 5-6s5 2 5 6-2 6-5 6-5-2-5-6z" fill="#E2B865"/></g></g>
<g class="flame"><path d="M476 163c-6-6-6-13 0-22 6 9 6 16 0 22z" fill="#D97757"/><path d="M476 161c-2-3-2-7 0-11 2 4 2 8 0 11z" fill="#EBDBBC"/></g>
<g transform="translate(640 214) scale(1.3)"><!-- the house figure: drawn around its own ground point (0,0), placed and scaled here -->
<path class="i" stroke-width="3" d="M0-46c.6 8 1 16 1.5 23.9"/><path class="i" stroke-width="2.6" d="M1.5-22.1c-2.4 5.2-5 10.2-7.5 15.4"/><path class="i" stroke-width="2.2" d="M-6-6.7c3 2.4 6 4.2 9 5.7"/>
<path class="i" stroke-width="3" d="M0-46c3 8 5 15 7.3 22.9"/><path class="i" stroke-width="2.6" d="M7.3-23.1c-2 5.6-4.6 11-7.3 16.4"/><path class="i" stroke-width="2.2" d="M0-6.7c3 2.4 6 4.2 9 5.7"/>
<path class="i" stroke-width="3.2" d="M0-46c.4-12.4 1-24.6 2-37"/>
<g class="head"><path class="h" d="M3-110c7-.4 11.6 4.6 11.4 11-.2 6.6-5 11.2-11.6 11-6.4-.2-11-4.8-10.8-11.2.2-6 4.6-10.6 11-10.8 1.6 0 3 .3 4.2.9"/><path class="i" stroke-width="2.2" d="M-6-106c-5 2-8 6-8 12"/></g>
<g class="arm"><path class="i" stroke-width="3" d="M2-79c1.6 5 3 10.2 4.2 15.4"/><g class="fore"><path class="i" stroke-width="2.6" d="M6.2-63.6c3 4.6 5.6 9.2 8 14"/></g></g>
</g>
</svg>
```

## templates/icon.svg

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<style>
.i{fill:none;stroke:#141413;stroke-width:6.5;stroke-linecap:round;stroke-linejoin:round}
.t{fill:none;stroke:#141413;stroke-width:4.5;stroke-linecap:round;stroke-linejoin:round}
.flag{transform-origin:34px 30px;animation:fly 5s infinite}
/* one action, then rest: the pennant hangs, fills with wind once, settles, and holds still for over 2 s */
@keyframes fly{0%,10%{transform:scale(1,1) rotate(0deg)}16%{transform:scale(.62,1.04) rotate(14deg);animation-timing-function:cubic-bezier(.3,0,.2,1)}34%{transform:scale(1.08,.96) rotate(-5deg)}44%{transform:scale(.97,1.02) rotate(2deg)}54%,100%{transform:scale(1,1) rotate(0deg)}}
</style>
<path d="M14 95c22 2 48 2 72 0" fill="none" stroke="#CFC2AC" stroke-width="7" stroke-linecap="round"/>
<path d="M22 92c8-7 18-7 26 0z" fill="#E3DACC"/>
<path class="t" d="M21 92c9-8 19-8 28 0"/>
<path class="i" d="M34 90c.6-26 .4-52-.2-78"/>
<g class="flag"><path d="M36 18c16 2 32 6 48 13-16 5-32 9-47 12z" fill="#D79473"/><path class="t" d="M35 17c17 2 33 6 50 14-17 5-33 9-50 12"/></g>
<path d="M30 9c2-3 6-3 8 0 2 3 0 7-4 7s-6-4-4-7z" fill="#E2B865"/>
</svg>
```

## templates/border.svg

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 110">
<style>
.p{fill:none;stroke:#2F4A6B;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.q{fill:none;stroke:#2F4A6B;stroke-width:1.3;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.boat{animation:boat 12s infinite}
.drop{transform-origin:353px 34px;animation:drop 12s infinite}
/* something travels a long way along an edge, then rests; nothing else moves */
@keyframes boat{0%,6%{transform:translate(0px,0px)}10%{transform:translate(-5px,0px);animation-timing-function:cubic-bezier(.3,0,.2,1)}44%,54%{transform:translate(196px,0px);animation-timing-function:cubic-bezier(.3,0,.2,1)}88%,100%{transform:translate(0px,0px)}}
@keyframes drop{0%,54%{transform:translate(0px,0px) scale(1);opacity:1;animation-timing-function:cubic-bezier(.5,0,1,.6)}64%{transform:translate(0px,50px) scale(1);opacity:1}66%,70%{transform:translate(0px,50px) scale(1);opacity:0}70.1%{transform:translate(0px,0px) scale(.2);opacity:0}80%,100%{transform:translate(0px,0px) scale(1);opacity:1}}
</style>
<path d="M8 8c14-2 30-2 44 0l-1 22c-14 2-28 2-42 0z" fill="#E2B865" opacity=".5"/>
<path d="M84 96c60-2 130-2 200 0 20 1 40 1 60 0l-1 7c-88 3-174 3-260 1z" fill="#C9D6DF" opacity=".75"/>
<path class="p" d="M18 6c52-2 104-2 156-2M186 4c52 0 104 1 156 3M342 7c8 1 11 5 12 12 1 22 1 46-1 68M353 87c-1 9-5 14-13 15-106 3-212 3-318-1M22 101c-9-1-14-5-15-14-1-22-1-44 1-66M8 21c1-9 4-13 12-15"/>
<path class="q" d="M14 14l9 12M30 11l1 15M46 15l-8 11M20 30c7 3 15 3 22 0"/>
<path class="q" d="M96 4v5M120 4v3M144 4v5M168 4v3M210 4v5M234 4v3M258 5v5M282 5v3M88 9c70-1 140-1 204 0"/>
<path class="q" d="M92 97c8-4 14-4 22 0 8 4 14 4 22 0 8-4 14-4 22 0 8 4 14 4 22 0 8-4 14-4 22 0 8 4 14 4 22 0 8-4 14-4 22 0 8 4 14 4 22 0 8-4 14-4 22 0 8 4 14 4 22 0"/>
<g class="boat"><path d="M100 92c6 1 12 1 18 0l-3 6c-4 1-8 1-12 0z" fill="#D79473"/><path class="q" d="M100 92c6 1 12 1 18 0l-3 6c-4 1-8 1-12 0zM109 92v-10M109 82c4 2 6 5 7 9"/></g>
<g class="drop"><path d="M353 34c2 3 3 5 3 7 0 2-1 3-3 3s-3-1-3-3c0-2 1-4 3-7z" fill="#C9D6DF" stroke="#2F4A6B" stroke-width="1.1" vector-effect="non-scaling-stroke"/></g>
</svg>
```

---

# Your request

