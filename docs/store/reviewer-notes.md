# Reviewer testing notes

## 3.6.0 offline release scope

This release redraws Make it yours and the top bar, fixes Biscuit settings, and restores the workspace button after a tab returned to Canvas during loading. It retains local Biscuit commands, timers and routines; submission play tools; the Starry Night, Under the Sea, Starfield and Blueprint themes; course docks, the Market, Modules progress and To hand in. Focus room, Review deck and Grade impact are opt-in Custom features. Lite excludes scene themes, play and media playback; saved media stays in backups. Public school registration, provider handoff, the feature loader and existing saved data are retained.

The Market host is optional and is requested on its popup click. Only packaged code runs. Pack and asset SHA-256 hashes, schemas, SVG isolation, account separation and exact removal are checked offline. The four scene folders are bundled; dynamically loaded pages and styles are listed explicitly in the manifest. Use your own picture or short video as a banner, framed the way you want. Upload, drop and paste support dashboard and course banners, card art and an optional dimmed background. Images are scaled on the device; large videos are recorded at the slot size. Motion off, reduced motion, hidden tabs and offscreen slots show stills. The frame editor, kits and backups retain framing and media. Nothing is uploaded.

The 3.6.0 port requires the serial Node suite, check, deterministic build and extracted ZIP audit before release. Earlier browser observations below describe earlier versions; they do not establish 3.6.0 rendering, authenticated Canvas behavior, provider editor compatibility or live performance.


Canvas Harness is an independent Canvas study workspace. It supports HTTPS school sites on `*.instructure.com`. A school that runs Canvas on its own address can be added in the popup: entering `https://canvas.your-school.edu` asks the browser for access to that one origin (optional host permission), after which the same Canvas scripts are registered for it with `chrome.scripting.registerContentScripts`. Removing the site revokes the permission and unregisters the scripts.

## Live coursework

Use a test student account on a supported Canvas site with at least two courses and a few assignments. Canvas data depends on that school's API permissions. No developer credentials are included or required by the source code. If a review requires supplied login credentials, the publisher must arrange an authorized test account separately; personal student credentials must not be shared.

1. Sign in to Canvas normally and open its dashboard. Verify course information, assignments and instructions are shown, with links to original Canvas pages.
2. Click a panel heading normally: no hold animation should appear. Hold it for about half a second: feedback starts at 250 ms, and the panel lifts at 420 ms. Drag horizontally over another panel to swap; drag to the bottom edge to stack. Escape cancels. Release or cancellation locks movement immediately.
3. Hold and reorder a course. Its subject artwork stays on the floating card. Hold the Courses heading to move navigation across the top or back to the side.
4. Open settings and Tools. They occupy a side dock while the page stays interactive. Close and reopen them to check the animated resize.
5. Bookmark an assignment and check its course and All courses. Select work with its circle, then choose local completion or AI context. Local completion does not submit coursework.
6. Show grades and open GPA only using test data. Adjust weights; Canvas grades must remain unchanged.
7. Under course artwork, import a self-contained animated SVG. Unsafe SVGs containing scripts, event handlers or external resource references must be rejected.
8. Open Quick Upload in Appearance settings. Paste or choose a `.chpack` file, such as the repository's artificial Astronomy example. Verify the three isolated previews. Map its unmatched target to a test course (or uncheck it); Apply must remain disabled while an included course has no destination. Apply the pack, inspect the chosen course's banner/icon/border, then Undo last pack. Names, notes and grades must remain unchanged.
9. Open Features in the popup. Verify Full is the default, choose Lite and reload Canvas, then use Custom switches. Dependencies should follow automatically, and switching back should restore access to saved notes, artwork and preferences.

10. Choose course navigation across the top. The banner and title should precede the course strip, and the heading, strip and Home should scroll together. Home modules should be as tall as their content. Switch back to the sidebar and verify the heading remains usable.
11. Open a PDF from course Files, a Modules file item, a page, announcement, discussion, syllabus, course home, Materials and Linked materials. Verify the reader opens with the correct file; explicit Download links and non-PDF files should retain Canvas behavior. In Tools, open AI and verify the toolbox supplies the single close control.

12. Choose the course dock and each dock size, then switch back to the sidebar and top strip. Check long names, keyboard selection and Undo.
13. Ask Biscuit for a focus timer in different word orders, a pomodoro, a break, a reminder, a Planner block and timer status. Try a setting, feature, Home module, note, bookmark and Undo. Unknown text should open a draft in the existing AI handoff, without sending it.
14. Submit harmless work on a test assignment. A new receipt should show one random tool, with stronger tools rarer and a reveal for a rare tool. Put it back must restore the page. Switching Play or On Canvas off must remove its effects.
15. Choose Starry Night, Under the Sea, Starfield and Blueprint. Check reduced motion, hidden tabs, pause and the Starfield pointer's small reach. Lite must omit these scenes and Play.
16. Open Market and grant its optional host only if desired. Install and remove each supported data kind; unsupported kinds should be skipped. Import a local artwork pack, kit, theme, pet and preset through Add from a file. Check hash rejection, preview, Planner target week, exact Remove/Undo, backups and Full → Lite → Full persistence.
17. Verify Modules progress and To hand in. Enable Focus room, Review deck and Grade impact in Custom; they must start off in Full and Lite, stay account-separated and leave Canvas data unchanged.

## Optional AI website handoff

1. Select an assignment or document on the Canvas page. Open Tools → AI and choose a provider.
2. Review the context and PDF inclusion setting, write a harmless test question, and leave automatic submission off for the first check.
3. Press Send. Grant optional access only to the chosen provider if prompted. Its website opens in a browser tab; sign in directly on that website if necessary.
4. Verify the prepared question and selected context appear in the composer. Login requirements and provider UI changes can affect readiness. Existing unrelated draft text should not be silently submitted.
5. If testing automatic submission, explicitly enable it and send only harmless test content. Enter sends from the CH question field; Shift+Enter inserts a new line.
6. Include a small text-based PDF if desired. PDF text is extracted locally; scanned, encrypted, oversized or unsupported documents may not yield usable text. This feature does not promise a binary attachment upload to every provider.

AI provider accounts are separate from Canvas Harness. This release does not require a subscription-linking native companion. Desmos is loaded from its own website when the Calculator tab is opened.

## Artificial preview

The public repository contains an artificial-data preview for inspecting layouts without school credentials. From the source repository, run `npm run preview` and open the printed localhost URL. The preview and its example data are excluded from the submitted extension ZIP. It demonstrates the interface; it does not substitute for testing installed content scripts and real provider handoffs.

18. In Make it yours, select All courses, each course and Theme. Upload, drop and paste a picture, animated image, sanitized SVG and short MP4/WebM. Check Fit/Height chips, focus, zoom, one-decimal loop fields and stills. Resize the slot; check the media continues to match it. Refresh with the framing panel open; both previews and controls should remain editable. Test offscreen, hidden-tab, reduced-motion and Motion off playback, then export/import a kit and backup, including in Lite.

## Privacy boundaries

No credentials, private school caches, real student grades or developer course records are included. The bundled executable code is local. The public privacy policy explains local storage and intentional third-party AI transfers.
