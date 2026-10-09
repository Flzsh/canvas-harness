# Examples

Sets made by an assistant using only this skill, kept here to show the level expected and how a plan turns into
files. They are not templates: a new course gets its own plan, its own title idea and its own border.

| Folder | Request it answered |
|---|---|
| `astronomy/` | "Astronomy. This term: naked-eye observing and the Moon's phases, building and aligning a small refractor, Kepler's laws and orbits, stellar spectra with a diffraction grating, the Hertzsprung-Russell diagram. Course colour #2F4A8C. Light theme. All three pieces." |
| `music-theory/` | "Music Theory. This term: the grand staff and key signatures, intervals and triads, the circle of fifths, four-part harmony at the piano, rhythm and metre with a metronome and conducting patterns, ear training with a tuning fork. Course colour #7A3F6B. Light theme. All three pieces." |

Each folder holds `<course>-banner.svg`, `<course>-icon.svg`, `<course>-border.svg` and the `PLAN.md` written before
drawing (with a note of what changed after rendering). `astronomy/generator/` also has the scripts that wrote its
files, as an example of a generator.

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

## What to notice in `music-theory/`

- **One musical event** is told by everyone: the key moves up a fifth. The hand of the circle of fifths is drawn from
  C to G, the two sharps are chalked onto both staves stroke by stroke, the fork is struck and lifted to the ear, and
  on the conductor's downbeat the pianist's hands drop and the singer's voice sounds. The metronome keeps the beat
  the whole time, so the beats land on its ticks.
- **The notation is correct:** the order of the circle, the clefs, the key signature on both staves, the chord.
- **The title sits on a real grand staff,** MUSIC on the treble staff and THEORY on the bass, with a whole note for
  the O and a tuning fork for the Y that rings when the singer strikes hers.
- **The view was chosen for its silhouette:** a grand piano from the side, where an upright would have read as a cupboard.

Neither is perfect, and each plan says where: stations stand a little too evenly side by side, nobody moves their
whole body, and the lettering is regular enough to look almost typeset. Do better.
