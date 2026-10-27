<!-- PDF mark-up tools adapted from HarryX081125's work, issue #53. -->
# PDF reading beside Canvas — 3.6.0

The workspace PDF reader opens identified PDFs from assignment and submission pages, the Course hub, My links & files, Files and module items. Feature switches still control loading. Quiz pages never activate the reader. Modified and middle clicks retain their normal browser behavior. Ordinary pages keep one click listener; only Files routes watch for address changes.

Canvas Files rows with `?preview=ID`, file addresses and module items labelled "PDF File" use the reader. An unlabelled Canvas file link is checked with one read-only `GET /api/v1/files/ID`; other file types continue to Canvas. HTTPS links ending in `.pdf` on other sites open at `#page=N` when supplied. A site's optional access is requested once through the existing optional `https://*/*`, for that exact origin only. A decline returns to the original viewer or link without asking again. No install-time permission is added.

The credentialed download starts at the same-origin Canvas file endpoint and has a 32 MiB byte limit. External PDFs use requests without credentials. Saved local PDFs use the existing randomized reader URLs on trusted custom Canvas sites; ordinary Canvas links on those sites keep their original viewer. Blocked or unsupported downloads replay the original interaction. "Open in Canvas's own viewer" hands a Canvas file back for this tab's session; "Open in Harness reader" switches back. Local saved files retain their original filename and their existing account checks, without the AI handoff.

The host transfers the PDF bytes into a local extension iframe. The reader imports the existing vendored PDF.js module and starts its local module worker. It never runs document scripts, XFA, embedded actions or remote code. A single queue renders the visible pages and their immediate neighbours. Canvases and page resources more than three pages from the visible window are released. Thumbnails use that queue only after idle time with the side view open. Hiding the document cancels render/text work, idle callbacks and search timers; reopening resumes on demand.

Highlights, underlines, strike-through, sticky notes, text boxes, shapes and ink use PDF coordinates, independently of zoom and display pixel ratio. They are stored in this browser profile under `reserve:pdf:<Canvas origin>:<verified account ID>:<file ID>`, separated by account like the rest of the workspace. Marks load only after a read-only Canvas self-profile check; returning to a hidden tab hides them until the account is verified again. Older site-and-file records migrate once to the first verified account that opens that file, then the old key is deleted. Per-file mutations use a shared extension-origin lock and merge against the latest stored record; storage changes refresh other open readers. They are not written into the original Canvas PDF. An explicitly saved copy with marks can contain them. Undo, redo and erasure affect these local annotations. A storage failure leaves the current marks visible and explains how to recover before closing. Theme follows the explicit `reserve:appearance` preference; dark mode is never inferred from the system.

Each file's serialized annotations are capped at 1 MiB. If saved annotations cannot be restored, editing is disabled so the unread record cannot be overwritten. PDF.js teardown waits for worker cleanup before terminating the external worker; a bounded timeout handles an unresponsive worker.

Ask AI hands off only the chosen text or page text, with the document name and page reference, to the existing local AI pane after verifying the Canvas account. Opening that pane does not send text to a provider. The student reviews the context and presses Send before it is placed on the chosen AI website. Annotations are never included. The handoff accepts up to 100,000 characters; the AI pane's separate PDF attachments retain their smaller limits. Image-only pages have no searchable/selectable text without OCR. Password-protected PDFs use the original Canvas viewer.

## Mark-up tools

The dock at the foot of the reader uses paper controls and nine drawn tool icons: Strike through, Highlighter pen, Text box, Shapes, Box, Oval, Arrow, Line and Open in Canvas's own viewer. Redo reuses the existing Undo drawing, reflected. The find field uses only the search icon's magnifying glass inside its drawn outline.

Highlight (H), underline (U), strike through (K), pen (P), highlighter pen (M), text box (T), sticky note (N), shapes (R) and eraser (E) are available. Pen has three widths. Drawing tools remember their own colour and width; text boxes remember their colour and size. These preferences stay on this device. Typing into inputs does not change tools. Ctrl/Command Z undoes; Ctrl/Command Shift Z or Ctrl Y redoes. Changing a mark after undo clears redo.

The Marks tab lists every mark by page. A mark opens its page. Copy as notes writes to the clipboard only when pressed; Download .md saves a study sheet locally after rechecking the Canvas account. Text highlights, underlines, strikes, sticky notes and text boxes are grouped by page and position. Document text stays literal in Markdown; drawings and marks without text are counted as omitted. Filenames are made safe for the device. Save a copy with my marks writes the new mark types as PDF annotations too, with stroke-width padding around ink. Text outside the PDF writer's character set is preserved in a native popup. Originals stay unchanged.

Opening and resizing fit the page width, capped at 300%. Two pages side by side remains available. Pinch or Ctrl/Command wheel and Ctrl/Command +/-/0 zoom from 20% to 500% or restore fit. The last page is stored separately for each verified account and file, including local PDFs. A page specified by the opening link takes precedence.

## Owner's browser acceptance

Local browser checks covered the artificial settings panel and heading layout at 901, 1200 and 1400 px. Reader source and fixture checks do not establish installed behavior. On an installed extension, check these with a signed-in Canvas session:

- Load assignment detail, submission/new and feedback pages without touching a PDF. Confirm unchanged Canvas controls, upload fields and page layout.
- Open a PDF link and the Canvas PDF preview toggle. Check modified/middle clicks and non-PDF links still follow Canvas behavior.
- Resize with the divider, including keyboard arrows, then close and reopen. Check the remembered width and exact restoration of Canvas's prior inline styles and focus.
- Scroll a long mixed-size PDF, zoom during a render, open/close thumbnails, switch tabs and return. Check selection alignment, search navigation, rotated pages and outline destinations.
- Add each annotation, type and move text, switch tool colours and widths, zoom, reload, erase, undo/redo, copy notes and download Markdown; exercise a storage failure. Check notes and colours in explicit light/dark themes and with reduced motion.
- Ask AI from a selection and page text, including with no provider configured. Confirm only the chosen text is prepared, annotations stay local, and the provider receives nothing before Send.
- Try an authenticated Canvas download that redirects to a separate file-storage host. If CORS or existing host access blocks reading, confirm the explanation and fallback to Canvas's original viewer. Any optional access must name one exact site; declining must return to the original interaction without a repeated prompt.
