# Canvas Harness privacy

Applies to Canvas Harness 2.26.1. Last updated October 15, 2026.

Canvas Harness is a browser extension maintained by Flzsh. It displays information from the Canvas account already signed in on your school's website. It has no developer-operated account service, analytics collector or tracking endpoint in the extension code for this release.

## Canvas access and local storage

- Canvas Harness reads courses, assignments, due dates, teacher materials, announcements and grades that your signed-in Canvas account is allowed to view. Canvas API requests are read-only.
- The extension can cache fetched Canvas information, including course and assignment details and grade data, in your browser. Personal notes, plans, bookmarks, homework check-offs, imported course artwork, layout choices, GPA preferences and the study companion's name, look and progress counters are also stored locally.
- The extension uses Chrome/Edge extension local storage and separates saved data by school Canvas origin and account ID. It does not send these records to a Canvas Harness developer server or synchronize them through a Canvas Harness account.
- Cached coursework becomes visible only after the signed-in Canvas account is verified. Returning to an idle tab temporarily hides private content while the account is checked again; a different account cannot inherit the previous account's visible workspace. The one exception is a switch you control: **Open at once** (off unless you turn it on) shows your saved workspace immediately on load and on returning to the tab while the same account check runs, and closes the workspace if the check fails. While it is on, the extension also remembers the account ID that last opened the workspace on that Canvas site. Leave it off on a shared computer.
- Grades are hidden by default in the interface, but hiding them does not necessarily remove them from the local cache. GPA and what-if calculations run locally. Grade and GPA data are excluded from the AI context builder.
- Checking off homework or making a personal plan changes only your local Canvas Harness data. It does not submit homework, edit a Canvas assignment or change your Canvas grade.

Personal backups are files that you choose to export. They can contain private notes, preferences, artwork and other personal information. Keep them private. The public extension package and example previews should contain only shared code, generic artwork and artificial example data, never your exported backup or personal course records.

## AI websites: your choice to share

**Tools → AI** can open ChatGPT, Claude, Gemini, Grok, DeepSeek, Kimi, Qwen or Z.ai in a normal browser tab. Opening the site or reviewing context in Canvas Harness does not transfer coursework to that provider.

You choose sources using the selection circles in Canvas. An opened assignment starts selected, and its attached PDFs may be included while the **Include attached assignment PDFs** option is on. You can also choose linked assignment materials, teacher pages or other course sources. Review the text and warnings before sharing. Canvas Harness excludes grades, GPA inputs, submission records, private planner notes, account tokens and course rosters from its selected instructional context, but the documents themselves may contain names or other personal information.

When you click **Send**, Canvas Harness prepares the chosen text and your question and inserts them into the selected AI website's chat box. **That text has reached the provider's website even if you have not submitted the chat.** By default, you review and submit it there. If you enable **Send automatically after inserting**, Canvas Harness also attempts to press that website's Send button. The provider's own account settings, privacy policy and data retention rules apply. **Copy** puts the prepared text on your clipboard only when you ask for it.

PDF processing happens locally in the extension. A small PDF from Canvas or your device is converted into limited extracted text for your review. The AI handoff uses that text; it does not upload the original binary PDF file. PDFs are limited to 2 MiB and extraction to 20 pages and 60,000 characters per file, with a 100,000-character combined context limit. There is no OCR for scanned images. Attached-PDF text and your unsent question remain in the open panel's memory, not in the personal backup. Provider chat history is stored according to that provider's own rules.

## Browser permissions

Canvas Harness uses `storage` and `unlimitedStorage` for local data (so caches, artwork and notes are not cut off by the browser's default 10 MB extension limit), `offscreen` for local PDF text extraction, and access to HTTPS `*.instructure.com` Canvas pages. It does not request Canvas passwords or account API keys.

Some schools run Canvas on their own address, such as `canvas.your-school.edu`. If you enter one in the popup, the browser asks you to allow Canvas Harness on **that exact site**, together with the optional `scripting` permission it uses to run there. Only then does it run on that site, and only on pages that are Canvas. The manifest lists `https://*/*` as an optional host permission so that any school's address can be asked for; Canvas Harness requests one origin at a time and never asks for access to all websites. Removing the site in the popup or in the browser's extension site settings stops it running there.

Draft insertion into an AI website asks for optional `scripting` permission and access to **that provider's exact origin**. The allowed origins are `chatgpt.com`, `claude.ai`, `gemini.google.com`, `grok.com`, `chat.deepseek.com`, `www.kimi.com`, `chat.qwen.ai` and `chat.z.ai`. These permissions are optional; using **Copy** and pasting yourself is an alternative. Permission is not a standing instruction to share future coursework. You can remove provider website access in the extension's permission page or your browser's extension site settings.

Canvas Harness does not request access to all websites, cookie-reading, debugger or native-messaging permissions. Its normal AI handoff does not use a separate login, OAuth connection or companion service.

## Other websites and files

Opening **Tools → Calculator** loads Desmos's external graphing or scientific calculator in a frame. Canvas Harness does not pass your Canvas account or coursework to Desmos; Desmos can process its own site traffic under its privacy policy. Opening saved links also visits the destination website.

Some Canvas file downloads redirect from your school's Canvas site to an external file host chosen by Canvas. The extension requests the selected file from Canvas using your signed-in session, limits download size and does not add Canvas credentials to an external host request. If that browser download cannot be read, you can use Canvas to download the file yourself.

Imported SVG artwork is checked for unsafe content and saved in your browser. It is not sent to the developer or included in public release files. Keep privately customized art and backups out of public uploads.

Quick Upload reads pasted artwork packs or files you choose/drop locally. It previews validated images and course destinations before you apply them. Reading and reviewing a pack does not store it or transmit it to a service. Apply changes only the selected artwork and explicit banner fit/position options; one Undo is available while the page remains open, provided the affected artwork has not since changed.

## Removing data and contacting the developer

You can revoke optional AI provider permissions in your browser's extension settings. Removing the extension generally removes its extension-managed local storage; separately exported backups and files you saved remain wherever you put them. AI website messages must be managed with the provider.

Developer: **Flzsh**. For questions or privacy reports, use [GitHub Issues](https://github.com/Flzsh/canvas-harness/issues). Do not post personal Canvas information in a public issue.
