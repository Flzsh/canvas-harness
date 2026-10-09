# Examples

Sets made by an assistant using only this skill, kept here to show the level expected and how a plan turns into
files. They are not templates: a new course gets its own plan, its own title idea and its own border.

| Folder | Request it answered |
|---|---|
| `astronomy/` | "Astronomy. This term: naked-eye observing and the Moon's phases, building and aligning a small refractor, Kepler's laws and orbits, stellar spectra with a diffraction grating, the Hertzsprung-Russell diagram. Course colour #2F4A8C. Light theme. All three pieces." |

Each folder holds `<course>-banner.svg`, `<course>-icon.svg`, `<course>-border.svg`, the `PLAN.md` written before
drawing (with a note of what changed after rendering), and, where one was used, the `generator/` scripts that wrote
the files.

To see a set as Canvas Harness shows it:

```sh
node scripts/check.cjs examples/astronomy
```

then open the `preview.html` it writes.

## What to notice in `astronomy/`

- **One chain of cause and effect** crosses the banner: the telescope is nudged onto the chart's bright star, a
  beam runs to the screen, the grating is lowered into it, the spectrum spreads and its dark lines appear, and the
  star is plotted on the diagram. The reset happens in the first two seconds, so the still picture is the finished
  moment.
- **The title is the thing being observed.** The name is drawn as constellations on a star chart, and the telescope
  in the scene points at it.
- **The numbers are real:** the Moon's phases are in order, the planet keeps Kepler's second law, the absorption
  lines sit where a grating would put them, the star lands on the main sequence.
- **Icon and border are a pair:** in the course row the telescope points at the border's crescent, and a planet
  travels the long orbit along the bottom edge.

It is not perfect, and its own plan says where: the right third is more loosely tied to the rest than the left,
nobody moves their whole body, and the lettering is regular enough to look almost typeset. Do better.
