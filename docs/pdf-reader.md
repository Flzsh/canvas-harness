# PDF reading beside Canvas — 3.1.0

The reader is an opt-in companion to Canvas assignment and submission pages. It uses `ReserveSite.vanillaPage`; loading such a page leaves its content and appearance alone. An ordinary primary click on an identified PDF link or PDF preview opens the reading pane. Modified and middle clicks retain their normal browser behavior.

Reader resources are exposed only on Instructure Canvas origins. Registered custom school domains retain Canvas's native viewer, without wildcard reader exposure. The credentialed download starts at the same-origin Canvas file endpoint and has a 32 MiB byte limit. Redirects to a separate storage host such as inst-fs still depend on browser CORS and existing permissions; blocked downloads replay the original Canvas viewer interaction. No host permissions are added.

The host transfers the PDF bytes into a local extension iframe. The reader imports the existing vendored PDF.js module and starts its local module worker. It never runs document scripts, XFA, embedded actions or remote code. A single queue renders the visible pages and their immediate neighbours. Canvases and page resources more than three pages from the visible window are released. Thumbnails use that queue only after idle time with the side view open. Hiding the document cancels render/text work, idle callbacks and search timers; reopening resumes on demand.

Highlights, underlines, notes and ink use PDF coordinates, independently of zoom and display pixel ratio. They are stored in this browser profile under `reserve:pdf:<Canvas origin>:<verified account ID>:<file ID>`, separated by account like the rest of the workspace. Marks load only after a read-only Canvas self-profile check; returning to a hidden tab hides them until the account is verified again. Older site-and-file records migrate once to the first verified account that opens that file, then the old key is deleted. Per-file mutations use a shared extension-origin lock and merge against the latest stored record; storage changes refresh other open readers. They are not written into the original Canvas PDF. An explicitly saved copy with marks can contain them. Undo and erasure affect these local annotations. A storage failure leaves the current marks visible and explains how to recover before closing. Theme follows the explicit `reserve:appearance` preference; dark mode is never inferred from the system.

Each file's serialized annotations are capped at 1 MiB. If saved annotations cannot be restored, editing is disabled so the unread record cannot be overwritten. PDF.js teardown waits for worker cleanup before terminating the external worker; a bounded timeout handles an unresponsive worker.

Ask AI hands off only the chosen text or page text, with the document name and page reference, to the existing local AI pane after verifying the Canvas account. Opening that pane does not send text to a provider. The student reviews the context and presses Send before it is placed on the chosen AI website. Annotations are never included. The handoff accepts up to 100,000 characters; the AI pane's separate PDF attachments retain their smaller limits. Image-only pages have no searchable/selectable text without OCR. Password-protected PDFs use the original Canvas viewer.

## Mark-up tools and where PDFs open

A floating dock at the foot of the reader holds the tools: **highlight**, **underline** and **strike through** for selected text; a **pen** with three widths and a see-through **highlighter pen**; **text boxes** typed straight onto the page; **sticky notes**; a **box, oval, arrow or line**; and an **eraser**. Each tool has a one-letter shortcut (H, U, K, P, M, T, N, R, E). **Undo** and **redo** cover every change (Command Z, Shift Command Z). Colours and widths are remembered for each tool.

The **Marks** tab beside Pages and Outline lists every mark by page. A mark opens its page; **Copy as notes** and **Download .md** turn the list into study notes. **Save a copy with my marks** writes strike-through, text boxes, shapes and the highlighter pen into the PDF too, so other readers show them.

The page fits the reader's width (up to 300%) when it opens and when the reader is resized, and **two pages side by side** is one click. Pinch and Command +/−/0 zoom (20% to 500%). The reader reopens each file at the page last read.

PDFs also open from:
- a Files-page row (`/courses/C/files?preview=ID`, folders included) and the PDF's own file address, which opens the reader on arrival. Only Files routes watch their address; other pages keep just the click listener.
- module items Canvas names "PDF File …" (the label is dropped from the title).
- a Canvas file link whose name doesn't say what it is: one read-only `GET /api/v1/files/ID` decides, and anything that isn't a PDF continues as the link.
- an `https` link to a `.pdf` on another website, opened at its `#page=N`. The reader asks once for that site, through the existing optional host access. **Open it normally** leaves the link alone.

**Open in Canvas's own viewer** in the reader's heading hands the same file to Canvas for the rest of the tab's session. A small **Open in Harness reader** button then switches back.

When Canvas sends a download on to its file storage (`*.canvas-user-content.com`, `*.inscloudgate.net`) and CORS blocks the page from reading it, the reader page fetches the file instead. It first asks once for those two storage sites, which the manifest's existing optional `https://*/*` covers. No permission is added at install. If access isn't granted, the original Canvas viewer opens as before.

## Owner's browser acceptance

No browser was launched for this documentation and preview pass. The source and fixture checks do not establish installed behavior. On an installed extension, check these with a signed-in Canvas session:

- Load assignment detail, submission/new and feedback pages without touching a PDF. Confirm unchanged Canvas controls, upload fields and page layout.
- Open a PDF link and the Canvas PDF preview toggle. Check modified/middle clicks and non-PDF links still follow Canvas behavior.
- Resize with the divider, including keyboard arrows, then close and reopen. Check the remembered width and exact restoration of Canvas's prior inline styles and focus.
- Scroll a long mixed-size PDF, zoom during a render, open/close thumbnails, switch tabs and return. Check selection alignment, search navigation, rotated pages and outline destinations.
- Add each annotation, zoom, reload, erase, undo, and exercise a storage failure. Check notes and colours in explicit light/dark themes and with reduced motion.
- Ask AI from a selection and page text, including with no provider configured. Confirm only the chosen text is prepared, annotations stay local, and the provider receives nothing before Send.
- Try an authenticated Canvas download that redirects to a separate file-storage host. If CORS or existing host access blocks reading, confirm the explanation and fallback to Canvas's original viewer. No additional host permissions should be requested.
