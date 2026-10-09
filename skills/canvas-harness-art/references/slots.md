# The three pieces and how each is composed

A course gets three files. They are a set: one subject, one palette, one hand.

| File | Slot in Canvas Harness | What it is |
|---|---|---|
| `<course>-banner.svg` | Banner | A long living picture of what the course does, with the course name lettered into its left end. |
| `<course>-icon.svg` | Icon | One small drawing for the course list. |
| `<course>-border.svg` | Border | The hand-drawn frame of the course's row in the sidebar. |

Upload them in **Customize workspace -> Course artwork** (choose the course, then Upload or Paste SVG for each slot).
"All courses" has the same three slots for the overview.

---

## Banner (`viewBox="0 0 1680 240"`)

### How it is shown

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

### Layout

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

### Planning a banner (write this before drawing)

1. **List** 12 or more concrete things the course really uses and does (objects, instruments, diagrams, actions).
2. **Choose 3-5 set pieces** that draw well and can be shown working. Decide which are tall.
3. **Main event:** one sentence for what travels through the picture and what each piece does to it.
4. **Cast:** who stands where, each with goal -> action -> visible result -> reset, and one accessory.
5. **Timeline:** a table of seconds for every action on one cycle. Mark the rest pose.
6. **Title:** three ideas, the chosen one, what each colour stands for, its living detail.
7. **Overlaps:** what crosses each gap between groups; what is in front of what.

---

## Icon (`viewBox="0 0 100 100"`)

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

## Border (`viewBox="0 0 360 110"`)

The frame of the course row in the sidebar (or the course strip). The image is **stretched over the whole row**
(`preserveAspectRatio="none"`); the icon and the text of the row sit on top of it. A row is typically about
255 x 87 px in the sidebar and 225 x 84 px in the course strip, and can be as short as about 50 px or as tall as
about 140 px, so the image may be squeezed or pulled by up to about a third in either direction.

### What is inside the row (measured in Canvas Harness 2.19 and 2.20; keep these areas clear)

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

### What a border is made of

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

### The set

Icon and border are seen together in every row. Draw them as a pair: the same subject idea, the border's ink
colour chosen to sit well beside the icon's washes, and no repetition (if the icon is a flask, the border is not
six more flasks).
