# Release checks — Canvas Harness 2.22.1

The public suite passes **616 tests**, with no failures. Three optional isolated browser tests are skipped in the standard run. JavaScript syntax, manifest resources, icon dimensions, and package checks pass.

2.22.1 is an efficiency release: no feature changes. It was profiled in the preview page with the CPU slowed six times to stand in for a low-end Chromebook. Showing the workspace again after the account recheck on returning to a tab fell from about 1.8 s to about 0.5 s or less (the workspace is hidden with `content-visibility` while it waits, and still shows nothing until the check passes); style work on an idle page fell by about half. These figures come from the preview, not from a physical Chromebook. It also runs only on real Canvas pages and checks that every version number agrees.

The 2.22.0 checks add the Home modules and their arrangement (measured rows, module width, docking a module as a whole row or column), the planner model, the study companion's rewards, and the optional **Open at once** start: off, nothing saved is shown before the account check; on, an early view closes when the check names another account or cannot be made. These parts were exercised in the preview page with sample data.

The 2.21.3 runtime checks cover Canvas rate-limit retries, cancellation and listener cleanup, a shorter cache window for partial results, and the local storage permission. The complete suite also passes beside a synchronized sibling checkout.

These checks include account and school separation; selected-only AI context; queued saves and archive Undo; repeated Send, permission denial, cancellation and late completion; bounded PDF processing; Quick Upload validation, mapping, atomic Apply and guarded Undo; bookmarks; GPA rules; layout persistence; hold delay, cancellation, sideways swaps, stacking, and preservation of a moving course's frame.

This release also checks early document-start mounting, verified cache display, interrupted requests, account changes, idle-tab return and back/forward restoration. The native dashboard guard remains active while a returning tab rechecks its account; private content stays hidden during that check. Motion fixtures check opacity-only entrance, unchanged content remaining still, and reduced-motion and keyboard paths.

## Existing browser walkthrough

The public preview uses artificial courses, assignments and grades. The earlier Edge walkthrough checked:

- Illustrated titles and banners at 320, 390, 800, 1280, 1920, 2560 and 3840 CSS pixels, without horizontal overflow.
- The restored All courses greeting at 390, 800, 1280 and 1920 CSS pixels. Time-zone tests cover morning, afternoon, evening and late-night greetings; individual course names and uploaded overview titles remain intact.
- Assignment-first reading order on narrow screens, and full banner width on large screens.
- Selected-item actions beside the date strip, with no panel displacement when selecting or clearing. Isolated browser checks cover 320, 390, 600, 760, 761, 900, 1200, 1201, 1280, 1920, 2560 and 3840 CSS pixels.
- Course headings with and without status chips retain the same starting height for the panels below, including narrow dock layouts. The computed-layout fixtures include the public subject artwork stylesheet.
- Bookmark visibility in All courses and the corresponding subject.
- The Tools dock beside coursework and an actual loaded Desmos graphing calculator.
- Keyboard lift, a sideways panel swap, saved placement and Undo.
- The artwork skill's complete example pack: paste, review, three-piece course mapping, Apply, a banner with its own title, and Undo.

The README GIFs record actual artwork and interface states. The updated layout clip records pointer holding and dragging.

## What this does not establish

Controlled Canvas responses and browser API doubles cover automated failure paths. They do not prove live compatibility with every school's API permissions, locked or embedded teacher content, managed browser policies, or every AI provider's current editor.

The public walkthrough uses artificial content rather than an authenticated student's installed extension. Installed testing of the private Folio build does not establish support for every school. Pointer-hold behavior has automated coverage; the release recording uses accessible keyboard controls. Provider website insertion remains sensitive to editor changes and has a Copy fallback. No Chrome Web Store or Edge Add-ons approval is claimed.

For an installation check, reload the unpacked extension, refresh Canvas, compare one deadline with its original page, and test a provider with harmless sample text. Report reproducible problems without sharing private coursework or backups.

[Installation](../INSTALL.md) · [Get started](GETTING-STARTED.md) · [Privacy](../PRIVACY.md)
