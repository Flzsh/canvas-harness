# PDF reading beside Canvas — 3.1.0

The reader is an opt-in companion to Canvas assignment and submission pages. It uses `ReserveSite.vanillaPage`; loading such a page leaves its content and appearance alone. An ordinary primary click on an identified PDF link or PDF preview opens the reading pane. Modified and middle clicks retain their normal browser behavior.

Reader resources are exposed only on Instructure Canvas origins. Registered custom school domains retain Canvas's native viewer, without wildcard reader exposure. The credentialed download starts at the same-origin Canvas file endpoint and has a 32 MiB byte limit. Redirects to a separate storage host such as inst-fs still depend on browser CORS and existing permissions; blocked downloads replay the original Canvas viewer interaction. No host permissions are added.

The host transfers the PDF bytes into a local extension iframe. The reader imports the existing vendored PDF.js module and starts its local module worker. It never runs document scripts, XFA, embedded actions or remote code. A single queue renders the visible pages and their immediate neighbours. Canvases and page resources more than three pages from the visible window are released. Thumbnails use that queue only after idle time with the side view open. Hiding the document cancels render/text work, idle callbacks and search timers; reopening resumes on demand.

Highlights, underlines, notes and ink use PDF coordinates, independently of zoom and display pixel ratio. They are stored in this browser profile under `reserve:pdf:<Canvas origin>:<verified account ID>:<file ID>`, separated by account like the rest of the workspace. Marks load only after a read-only Canvas self-profile check; returning to a hidden tab hides them until the account is verified again. Older site-and-file records migrate once to the first verified account that opens that file, then the old key is deleted. Per-file mutations use a shared extension-origin lock and merge against the latest stored record; storage changes refresh other open readers. They are not written into the original Canvas PDF. An explicitly saved copy with marks can contain them. Undo and erasure affect these local annotations. A storage failure leaves the current marks visible and explains how to recover before closing. Theme follows the explicit `reserve:appearance` preference; dark mode is never inferred from the system.

Each file's serialized annotations are capped at 1 MiB. If saved annotations cannot be restored, editing is disabled so the unread record cannot be overwritten. PDF.js teardown waits for worker cleanup before terminating the external worker; a bounded timeout handles an unresponsive worker.

Ask AI hands off only the chosen text or page text, with the document name and page reference, to the existing local AI pane after verifying the Canvas account. Opening that pane does not send text to a provider. The student reviews the context and presses Send before it is placed on the chosen AI website. Annotations are never included. The handoff accepts up to 100,000 characters; the AI pane's separate PDF attachments retain their smaller limits. Image-only pages have no searchable/selectable text without OCR. Password-protected PDFs use the original Canvas viewer.

## Export a study sheet

Choose **Export highlights and notes** in the reader's heading. Review the text-mark count and choose Markdown (.md) or plain text (.txt), then select **Download notes**. The file groups highlights, underlines and margin notes by page and position. Drawings and marks without text are counted as omitted; no OCR is attempted. Markdown-looking and HTML-looking document text is exported literally.

The download uses the current account's local annotations, including pending edits. Canvas is asked to confirm the account again before download; an account switch or failed check cancels the export. This creates a local text file, leaves the original PDF and annotations unchanged, and sends nothing to AI. Keep the file private if it includes your own notes. **Save a copy with my marks** continues to export a PDF.

## Owner's browser acceptance

No browser was launched for this documentation and preview pass. The source and fixture checks do not establish installed behavior. On an installed extension, check these with a signed-in Canvas session:

- Load assignment detail, submission/new and feedback pages without touching a PDF. Confirm unchanged Canvas controls, upload fields and page layout.
- Open a PDF link and the Canvas PDF preview toggle. Check modified/middle clicks and non-PDF links still follow Canvas behavior.
- Resize with the divider, including keyboard arrows, then close and reopen. Check the remembered width and exact restoration of Canvas's prior inline styles and focus.
- Scroll a long mixed-size PDF, zoom during a render, open/close thumbnails, switch tabs and return. Check selection alignment, search navigation, rotated pages and outline destinations.
- Add each annotation, zoom, reload, erase, undo, and exercise a storage failure. Check notes and colours in explicit light/dark themes and with reduced motion.
- Ask AI from a selection and page text, including with no provider configured. Confirm only the chosen text is prepared, annotations stay local, and the provider receives nothing before Send.
- Try an authenticated Canvas download that redirects to a separate file-storage host. If CORS or existing host access blocks reading, confirm the explanation and fallback to Canvas's original viewer. No additional host permissions should be requested.
