# Permission and data disclosure worksheet

These explanations describe the public extension. The publisher must confirm the final package and the current store questions before certifying the answers.

## Single purpose

Organize a signed-in student's Canvas coursework in a customizable study workspace, with course updates, assignments, reading materials and optional study tools alongside it.

## Permissions

| Permission | Reason |
| --- | --- |
| `storage` | Save account-separated Canvas caches, settings, local plans, completion marks, bookmarks, GPA preferences and user-imported artwork on the device. |
| `unlimitedStorage` | Lift the browser's default 10 MB extension storage limit so account caches, artwork and notes for several Canvas accounts fit on the device. Data stays local. |
| `offscreen` | Use a local offscreen document to extract text from PDFs selected for AI context. The packaged PDF parser performs this work locally. |
| `https://*.instructure.com/*` | Render the workspace on supported Canvas sites and read coursework through the signed-in site's APIs. Different schools use different Canvas subdomains. The extension does not require the publisher's school. |
| Optional `scripting` | Insert a user-requested question and context into the selected AI website's supported composer. |
| Optional AI host access | Grant access to the specific provider selected by the user. No permission to all websites is requested. |
| Optional `https://*/*` (one school site at a time) | Some schools run Canvas on their own address instead of `*.instructure.com`. When a student enters that address in the popup, the extension requests access to that exact origin only (for example `https://canvas.school.edu/*`) and registers its Canvas scripts there. It never requests all websites; the wildcard only lets the student choose which school site to allow. Nothing runs on that site until the student allows it, and only on Canvas pages. |

List the exact optional provider origins from `extension/manifest.json` in the store form if required. Provider permission is requested when the user chooses the corresponding handoff, not to collect general browsing activity.

## Data handling

- **Website content:** course names, assignment instructions and deadlines, announcements, selected messages, course files, and PDF text may be read to display coursework. User-selected content and the user's question can be transmitted to the chosen AI provider when Send is used.
- **Personally identifiable information:** Canvas account identifiers and names can be processed for account separation and greetings. Coursework, user-authored questions, messages or files may themselves contain names or other identifying details. Do not promise automatic removal of such information.
- **Grades:** the extension can process course scores locally for the optional grade view and GPA estimates. Automatic AI context does not include the grade view. A user may independently type sensitive information into a question or select a document containing it.
- **Authentication:** Canvas and AI websites use their existing browser sessions. Canvas Harness does not ask the publisher to collect student passwords, extract session cookies, or collect AI subscription credentials.
- **Local preferences and activity:** bookmarks, completion marks, notes and layout choices are stored to implement visible features. There is no analytics service or general browsing-history collection.
- **Third-party websites:** AI providers receive the selected question and context when inserted into their pages, even if automatic submission is off. Desmos receives normal website requests when opened. These providers apply their own privacy practices.
- **Developer receipt:** there is no Canvas Harness backend collecting the above content for Flzsh. This does not eliminate the need to disclose optional transfers to providers or local handling of user data.

Map these facts to the stores' current categories. Website content and potential identifying information require particular attention. Do not declare health, finance, location, or browsing-history collection merely because a document could theoretically mention them; follow the store's definitions and the extension's actual operations. Do not declare that no data is handled.

## Remote code and permitted customization

The extension's executable JavaScript and PDF parser ship in the package. It does not download scripts as extension logic. SVG uploads are validated data rendered as images; script handlers, external references and unsafe markup are rejected. It does not support installing arbitrary executable plugins or userscripts.

Desmos is an external website in an isolated frame. AI chats open as external provider pages. Disclose those website integrations in reviewer notes; do not claim the entire product runs offline.

## Certifications

The intended uses are limited to the described coursework and optional study features. No selling user data, advertising use, creditworthiness decisions or unrelated analytics are implemented. The publisher must review the exact certification wording before agreeing to it.

Policy URL: https://github.com/Flzsh/canvas-harness/blob/main/PRIVACY.md
