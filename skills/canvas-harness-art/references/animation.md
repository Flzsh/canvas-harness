# Animation: drawn movement, never shaking

The pictures are alive the way a short hand-drawn film is alive: someone does something, it has a result, and then
the picture rests. They are not alive the way a screensaver is.

## The rules

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

## The rest pose (the rule that the format enforces)

Canvas Harness also shows a **static copy with every animation removed** (reduced motion, or animation switched off).
So the drawing as written, ignoring all `animation`, `transition`, `@keyframes` and SMIL elements, must be the
finished picture:

- Never give an element a base `opacity="0"`, `visibility="hidden"`, or a hiding `stroke-dashoffset` and rely on
  animation to reveal it.
- Things that appear during the loop are **visible at rest**; the loop takes them away early, then brings them back:
  `0%,4% {shown}  8%,24% {hidden}  58%,100% {shown}`.
- The rest pose is the most telling moment of the story (the pour, the reach, the finished drawing), not a neutral stand.
- Every `@keyframes` begins and ends (`0%` and `100%`) at the rest value.

## One clock

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

## The idioms that work in this format

There is **no path morphing** (`d` cannot be animated). All movement is built from these.

### 1. Joints: a figure is a puppet of rigid parts

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

### 2. Travel: move a whole thing

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

### 3. Drawing on: a line that writes itself

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

### 4. Fill, level, grow: scale from an edge

A liquid level, a bar in a chart, a thermometer, a growing shadow: scale the shape from its base.

```css
.level{transform-origin:412px 196px;animation:fill 12s infinite}   /* origin on the bottom edge */
@keyframes fill{0%,10%{transform:scale(1,1)} 20%,40%{transform:scale(1,.25)} 70%,100%{transform:scale(1,1)}}
```

Keep the outline outside the scaled group, so glass does not stretch with its contents.

### 5. Appear, light up, change state

Opacity keyframes for a lamp coming on, a tick being added, a speech bubble, a point plotted. A bubble or a mark
should **grow** in, not fade: scale it from the point where it comes from (`transform-origin` at the speaker's
mouth, the pen tip). A colour change is an `opacity` cross-fade between two stacked shapes.

### 6. Pose switching: drawn in-betweens

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

### 7. A walk (use sparingly)

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

## Performance

The image is rasterised as it animates. Keep it light:

- Animate `transform` and `opacity` wherever possible; `stroke-dashoffset` for drawing on. Do not animate filters,
  gradients or large fills.
- At most about 40 animated elements (elements that carry an animation) in a banner, 4 in an icon, 8 in a border.
- No `filter` at all in the house style.
- Small moving things over still large things. Never move the whole scene.

## Reading your own animation

Before you call it done, write out (or render) the picture at eight evenly spaced times of the cycle and check each:

- Is anything half-hidden, detached from the hand that holds it, or passing through something?
- Does the story read in order without captions?
- At t = 0 and at the end, is it the identical, complete rest pose?
- With all animation removed, is the picture finished and sensible?

`scripts/check.cjs` writes a preview page that shows eight frozen moments of every loop. The animated pictures on
that page play from the moment it loads, so a screenshot of them can catch the reset phase: judge from the frozen row.
