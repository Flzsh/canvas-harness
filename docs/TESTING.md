# Release checks — Canvas Harness 2.21.1

The public suite passes **499 tests**, with no failures. The standard command skips two optional isolated browser tests. JavaScript syntax, manifest resources, icon dimensions, package contents, and the artwork skill's 27 pack-format cases also pass.

These checks include account and school separation; selected-only AI context; queued saves and archive Undo; repeated Send, permission denial, cancellation and late completion; bounded PDF processing; Quick Upload validation, mapping, atomic Apply and guarded Undo; bookmarks; GPA rules; layout persistence; hold delay, cancellation, sideways swaps, stacking, and preservation of a moving course's frame.

## Browser walkthrough

The public preview uses artificial courses, assignments and grades. An Edge walkthrough checked:

- Illustrated titles and banners at 320, 390, 800, 1280, 1920, 2560 and 3840 CSS pixels, without horizontal overflow.
- The restored All courses greeting at 390, 800, 1280 and 1920 CSS pixels. Time-zone tests cover morning, afternoon, evening and late-night greetings; individual course names and uploaded overview titles remain intact.
- Assignment-first reading order on narrow screens, and full banner width on large screens.
- Bookmark visibility in All courses and the corresponding subject.
- The Tools dock beside coursework and an actual loaded Desmos graphing calculator.
- Keyboard lift, a sideways panel swap, saved placement and Undo.
- The artwork skill's complete example pack: paste, review, three-piece course mapping, Apply, a banner with its own title, and Undo.

The README GIFs record actual artwork and interface states. The layout clip uses keyboard moving; it is not a recording of pointer dragging.

## What this does not establish

Controlled Canvas responses and browser API doubles cover automated failure paths. They do not prove live compatibility with every school's API permissions, locked or embedded teacher content, managed browser policies, or every AI provider's current editor.

The walkthrough uses the public preview rather than an authenticated student's installed extension. Pointer-hold behavior has automated coverage; the release recording uses accessible keyboard controls. Provider website insertion remains sensitive to editor changes and has a Copy fallback. No Chrome Web Store or Edge Add-ons approval is claimed.

For an installation check, reload the unpacked extension, refresh Canvas, compare one deadline with its original page, and test a provider with harmless sample text. Report reproducible problems without sharing private coursework or backups.

[Installation](../INSTALL.md) · [Get started](GETTING-STARTED.md) · [Privacy](../PRIVACY.md)
