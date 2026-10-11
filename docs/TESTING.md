# Release checks — Canvas Harness 2.21.2

The public suite passes **585 tests**, with no failures. The standard command skips three optional isolated browser tests; all three also pass when explicitly enabled. JavaScript syntax, manifest resources, icon dimensions, and package checks pass.

These checks include account and school separation; selected-only AI context; queued saves and archive Undo; repeated Send, permission denial, cancellation and late completion; bounded PDF processing; Quick Upload validation, mapping, atomic Apply and guarded Undo; bookmarks; GPA rules; layout persistence; hold delay, cancellation, sideways swaps, stacking, and preservation of a moving course's frame.

This release also checks early document-start mounting, verified cache display, interrupted requests, account changes, idle-tab return and back/forward restoration. The native dashboard guard remains active while a returning tab rechecks its account; private content stays hidden during that check. Motion fixtures check opacity-only entrance, unchanged content remaining still, and reduced-motion and keyboard paths.

## Browser walkthrough

The public preview uses artificial courses, assignments and grades. An Edge walkthrough checked:

- Illustrated titles and banners at 320, 390, 800, 1280, 1920, 2560 and 3840 CSS pixels, without horizontal overflow.
- The restored All courses greeting at 390, 800, 1280 and 1920 CSS pixels. Time-zone tests cover morning, afternoon, evening and late-night greetings; individual course names and uploaded overview titles remain intact.
- Assignment-first reading order on narrow screens, and full banner width on large screens.
- Selected-item actions beside the date strip, with no panel displacement when selecting or clearing. Isolated browser checks cover 320, 390, 600, 760, 761, 900, 1200, 1201, 1280, 1920, 2560 and 3840 CSS pixels.
- Course headings with and without status chips retain the same starting height for the panels below, including narrow dock layouts. The computed-layout fixtures include the public subject artwork stylesheet.
- Bookmark visibility in All courses and the corresponding subject.
- The Tools dock beside coursework and an actual loaded Desmos graphing calculator.
- Keyboard lift, a sideways panel swap, saved placement and Undo.
- The artwork skill's complete example pack: paste, review, three-piece course mapping, Apply, a banner with its own title, and Undo.

The README GIFs record actual artwork and interface states. The layout clip uses keyboard moving; it is not a recording of pointer dragging.

## What this does not establish

Controlled Canvas responses and browser API doubles cover automated failure paths. They do not prove live compatibility with every school's API permissions, locked or embedded teacher content, managed browser policies, or every AI provider's current editor.

The public walkthrough uses artificial content rather than an authenticated student's installed extension. Installed testing of the private Folio build does not establish support for every school. Pointer-hold behavior has automated coverage; the release recording uses accessible keyboard controls. Provider website insertion remains sensitive to editor changes and has a Copy fallback. No Chrome Web Store or Edge Add-ons approval is claimed.

For an installation check, reload the unpacked extension, refresh Canvas, compare one deadline with its original page, and test a provider with harmless sample text. Report reproducible problems without sharing private coursework or backups.

[Installation](../INSTALL.md) · [Get started](GETTING-STARTED.md) · [Privacy](../PRIVACY.md)
