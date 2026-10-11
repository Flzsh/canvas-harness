# Reviewer testing notes

Canvas Harness is an independent Canvas study workspace. It supports HTTPS school sites on `*.instructure.com`; custom Canvas domains are not currently supported.

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

## Privacy boundaries

No credentials, private school caches, real student grades or developer course records are included. The bundled executable code is local. The public privacy policy explains local storage and intentional third-party AI transfers.
