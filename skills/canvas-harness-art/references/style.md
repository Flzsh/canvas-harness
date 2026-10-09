# The house style

A calm, warm, hand-made look: ink line and loose flat washes on bare ivory paper, like a page from a sketchbook
that has learned to move. Small people built from a few strokes do the real work of the subject among real,
whole objects. It should feel drawn by a person in one sitting, never assembled from clip-art, never ruled, never
glossy.

## 1. What a picture is about

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

## 2. It has to make sense

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

## 3. One image, not panels

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

## 4. The hand

All measurements are in drawing units of a banner 240 units tall. Canvas Harness shows a banner fairly small
(140 px tall by default), so everything is drawn a size bolder than you might expect.

### Ink

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

### Wash

Flat colour, no gradients, no outlines of its own.

- A wash is a loose shape that does **not** follow its outline exactly: shift it 1-3 units, let it stop short of one
  corner, like a hand-coloured print. It always belongs to an outline and stays within a couple of units of it.
- A big block has a slightly wavy lower edge.
- Under every block a soft shadow blob (`#CFC2AC`, 6-8 units thick, lying on the ground just under the floor line, at
  about y 216-222); under every foot or leg on the floor a small one (about 16 x 6).
- The largest wash in a group may carry one lighter lobe on top (`#FAF9F5` at opacity .35) as a highlight.
- Small coloured marks are dabs: short round-cap strokes 4-5 wide, not little rectangles.
- **Leave most of the paper bare.** The background is the page itself.

### Solids, hatching, grain

- A thin tapered sliver of ink (a lens 2-3 thick) under table tops, seats, shelves, and at a liquid's surface.
- Hatching: clusters of 2-5 short parallel strokes (7-12 long), all falling the same way, at the shaded end of a block.
  Roughly one cluster per 150 units of picture. Texture sits **inside** shapes and never replaces an edge.
- Grain: a sprinkle of tiny dots (zero-length round-cap strokes 1.8 wide, opacity .1) inside the large light washes.
  Leave it off dark washes (it does not show) and keep hatching off anything that carries a diagram (it reads as data).

### Layer order (back to front)

ground wash and shadows -> washes -> paper-filled shapes (heads, sheets) -> ink -> small solids and dots -> grain.
Figures and anything that moves sit in their own groups above the things they pass in front of.

### Palette

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

- Use 4-6 of these in one picture, plus **one subject accent** at most (a single extra hue used for one thing, warmed
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
- No pair of dots near a rounded end: it reads as a face.

### Dark theme

The art sits on the page with a transparent background and black ink, so it is made for the light paper theme.
If the user works in the dark theme, give the artwork its own ground: one calm hand-edged paper shape
(`#FAF9F5` or oat) behind the whole drawing, slightly irregular, so the picture arrives on its own sheet.

## 5. The cast

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

## 6. The lettered title

The course name is part of the artwork: the letters themselves are made of, written with, or grown out of the
subject. It stands at the left end of the banner.

- **The name is the artwork.** Not plain lettering with a prop beside it. Not a themed object next to a word.
  The strokes of the letters are the subject's own material.
- **One strong idea,** different for every course. Work out three candidates and choose. Examples of the kind of
  idea (use one if it really is the best idea for the course in front of you, but look for a better one first):
  - *Astronomy*: letters as constellations, bright stars joined by thin lines, on a deep-blue chart with a compass rose.
  - *Music Theory*: the word bent out of the five lines of a staff, note heads sitting where strokes end.
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
- **Not black by default.** Let the material give the letters colour and body: a coloured body with a darker pen
  edge, light letters on a dark ground the object really has, metal with one brushed gleam. Keep at least 3:1
  contrast between the letters and what is behind them.
- **Hand-drawn letterforms.** Each letter is its own slightly irregular drawing: no stem quite vertical, no two
  serifs alike. It must never be mistakable for a typeface. No `<text>`.
- **Tone fits the subject.** Playful for some courses, grave for others. A course about justice, memory or faith
  wants dignity (carved, cast, inked); a course about making things can be lively.
- If the title carries its own ground (a board, a slab, a chart), that object is whole, stands on the same floor
  line as the scene, and its colour is the colour that object really is.
- One or two living details that belong to the idea (liquid running through, a point travelling along a curve, a
  gleam crossing metal, a leaf unfurling). Then rest.

## 7. What to avoid (each of these was tried and thrown out)

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
