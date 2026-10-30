# Speed work in 3.8.0

Notes for the CHANGELOG. 3.8.0 carries a set of fixes for the dashboard redrawing, restyling and waking up more often than its picture changes. Nothing is meant to look different, except the two motion choices listed under "Motion choices".

## Fewer whole redraws

- Saving data that ends up unchanged no longer wakes the page (`storage.js`). A reload that finds data saved in another tab still tells the page.
- The minute timer no longer redraws Home and the course pages every minute (`dashboard.js`). It redraws only when the clock changes what they show: an hour turning in the account's time zone or this computer's, 24 hours before a due time, just after it, 14 days after it, and a minute before an "Updated" date. In between it updates only the status line. A page still redraws at least every 10 minutes. The Planner and the other workspaces still redraw every minute. The countdown keeps its own 15-second tick (`widgets.js`).
- Coming back to the tab redraws at most once (`content.js`, `dashboard.js`). The dashboard gets the same data back and keeps its caches. It redraws only if the clock changed what Home shows.
- Searches draw the list before the next paint, so keys typed during a slow redraw share one redraw.
- Saved kits redraw only the Make it yours panel when they arrive.

## A redraw that changes nothing writes nothing

- A redraw writes an attribute, data value, style property, tab index, `open` or `inert` only when the value changed (`dashboard.js`). Each same-value write used to wake every observer of the page, and the pony measured the whole page again after each one.
- A drawing that is already right is skipped whole instead of walked node by node.
- The list's polite live region stays in place and only its words change. It is found by its own `data-rd-list-live` marker.
- The idle-rest pause for scenes uses its own attribute (`scene-themes.css` / `scene-themes.js`). Starting or ending the rest no longer restyles the whole dashboard.
- Late content and toast icons fade in with `backwards` instead of `both` (`refresh.css`). The frames are the same, and a finished fade no longer stays on every node.

## The pony and the drawings share one clock

- While the drawings' film clock runs, the pony draws on its ticks (`motion.js` `onFilmTick`, `pets.js`), so the page draws one frame for both instead of two.
  - A walk keeps an even 24 frames a second whether the film runs at 24 or 12.
  - A reel is drawn at most half a film tick early.
  - With no film running (idle rest, hidden tab, Still, Off, reduced motion) the pony keeps its own timers.
- The pony checks whether animations have ended without forcing a style update. It reads animations once per tree instead of once per element. The drawings' own frame loops no longer make it measure the page again.
- One pony sync reads the workspace's context once. Engine offers reuse one indexed snapshot while nothing has changed.

## Smaller costs

- Day keys come from cached formatters with a bounded memo of answers (`core.js`, `dashboard-model.js`). Only the day-window filters work out the day difference.
- The drawn Canvas navigation reads both edges before it writes either (`canvas-nav.js`). It re-syncs when the font, surface style, scene or theme kit, page tint, theme or course navigation changes, and when the toolbar or rail changes size (this includes the workspace being revealed).
- A page being thrown away (`pagehide`, not kept for Back) is no longer covered before it goes.

## Motion choices

Applied from the 3.8 decisions: the clock option "smooth while on screen". The ornaments were first built as option (b) "let them move"; measured, that cost slow computers too much, so the owner chose (2026-10-28) to ship 3.8 with them still.

- **Rail and dock frame ornaments: they stand in their drawn pose.** Their rd-fl-* loops (153 rules and their keyframes in `refresh.css` and `subject-art.css`; `canvas-nav.css` regenerated) are removed from the 3.8 build, so no ornament loop ever starts and nothing steps them. Hover flourishes (rd-fh-*) are unchanged. Measured at 4x CPU with the loops moving on the film clock against the ornaments still: Home idle busy 66.7% vs 60.4%, course click input to paint 727 ms vs 636 ms, slow frames while scrolling 13.8% vs 5.6%. At 1x the moving loops cost about 1.7 points of idle busy and 3 ms per click. The code that would let them move stays in place (a redraw keeps `--rd-tf`/`--rd-op` in `dashboard.js` patchUI; `motion.js` takes rd-fl-* loops onto the film clock, pauses them off screen, and holds them while the page scrolls, ART_SCROLL_MS 200), so a cheaper loop can come back in a later version.
- **Motion clock: smooth while on screen.**
  - Scenes play at 24 frames a second whenever they are visible. There is no longer a 6-second window after input that drops to 12. Minis stay at their designed 12.
  - Scrolling with the wheel no longer pauses the drawings: they keep playing while the page scrolls.
  - A press or a key pauses them only until the page's answer has painted, and for 300 ms at most, instead of a fixed 700 ms.
  - The idle rest starts after 2 minutes without input (it was 25 seconds, against its own comment). The next input, or showing the tab again, resumes from the held frame.
  - Offscreen, a hidden tab, Motion Off and reduced motion still stop everything.

## Tests

New: `dashboard-freshness`, `dashboard-noop-render`, `storage-quiet-update`, `pets-film-ticks`, `pets-render-cost`, `date-caches`.

Extended: `motion-performance` (motion clock, press hold, rail ornaments, unread parts), `content-lifecycle` (pagehide, tab return), `dashboard-dom` (unchanged drawings skipped, custom properties kept), `canvas-nav`, `scene-themes`, `motion-spacing`, `pets-performance`, `render-performance`, `dark-mode`.
