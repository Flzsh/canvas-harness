# Install Canvas Harness

Canvas Harness 3.8.0: use Features in the popup for Full, Lite or Custom. The optional Market asks for its own site access on first use; Make it yours → More → Add from a file imports artwork, kits, themes, pets and presets. Modules progress and To hand in are included; Focus room, Review deck and Grade impact start off. Your school's own Canvas address is still added through the popup.

Canvas Harness is a browser extension for your signed-in Canvas courses, assignments, bookmarks, artwork and study tools. It is designed for desktop Chrome and Edge, version 126 or newer.

## Install from the Chrome Web Store

The easiest way: open [Canvas Harness on the Chrome Web Store](https://chromewebstore.google.com/detail/bppjpjpbichfcbgajlppkgbbncbfohgd), click **Add to Chrome**. A welcome page opens and asks for your school's Canvas address; enter it and click **Open my Canvas**, then sign in. In Edge, open the same link and choose **Allow extensions from other stores** when asked. Store installs update automatically, so the steps under Updates and backups below are only for unpacked installs.

## Install from GitHub in desktop Chrome or Edge

1. Download a **Canvas-Harness-<version>.zip** package from [GitHub Releases](https://github.com/Flzsh/canvas-harness/releases) if one is available, or download the [source repository](https://github.com/Flzsh/canvas-harness).
2. Extract the download to a folder you will keep. For the packaged extension, use its extracted folder containing `manifest.json`. For a source-repository download, use its `extension` subfolder.
3. Open `chrome://extensions` or `edge://extensions` in the browser.
4. Turn on **Developer mode**, choose **Load unpacked**, and select the folder containing `manifest.json`.
5. Sign in to your school's Canvas website and refresh the page. Disable other extensions that replace the Canvas dashboard if they conflict.

Keep the installed folder where it is. Moving or deleting it can break an unpacked installation. If your managed browser blocks unpacked extensions, ask your school's IT team which installation methods are allowed.

## Version 3.8.0 feature choices

Open **Features** in the popup and choose Full, Lite or Custom. Full is the default. Custom switches include dependencies automatically and remember your selection when you try another preset. Reload Canvas to apply. Turning features off preserves their saved data. Local artwork packs appear with Drawings; they are on in Full and in the default Custom selection and include the artwork editor they need.

Canvas Harness requires the browser's `scripting` permission to inject only the selected packaged modules into supported Canvas pages. School and AI website access is still requested one site at a time.

## First use

Open **Appearance settings** to choose the layout, rename or hide courses locally, and upload your own SVG artwork. **Quick Upload** accepts a complete artwork pack by paste, file selection or drop. Review the previews and course matches before Apply; Undo last pack restores the previous affected artwork.

On Home, hold a course or panel heading until it lifts, then drag and release. You can reorder courses and place sections beside or below one another. Every move requires a separate hold; releasing returns to normal use. Keyboard controls are explained in the [README](https://github.com/Flzsh/canvas-harness#move-courses-and-panels-directly).

Use **Tools → GPA** for local 4.0/4.3 estimates and what-if grades, **Tools → Calculator** for external Desmos calculators, and **Tools → AI** to review selected coursework and paste it into a provider website. AI provider access is optional. See [Study with AI](AI.md) before sending any coursework.

The popup can detect the current Canvas tab or accept your school's Canvas URL. Supported sites are HTTPS Canvas subdomains of `*.instructure.com`. If your school runs Canvas on its own address (for example `canvas.your-school.edu`), enter that address in the extension's popup and click **Open Canvas dashboard**. Your browser asks to allow that one site; nothing else is added. You can remove it from the popup or from the browser's extension site settings. School Canvas settings may affect which information is available.

## Permissions and privacy

- The extension needs browser storage, local PDF processing, and access to signed-in Canvas pages on `*.instructure.com`, plus any school Canvas address you add yourself (asked for one site at a time). It uses your current Canvas session; it does not ask for a separate Canvas password or API key.
- Course information and fetched Canvas data can be cached in local browser storage. Personal settings, notes, bookmarks, checked-off work, imported art and GPA preferences are stored locally per Canvas site and account. Grades are hidden by default in the interface but may still exist in the local cache.
- Checking off work in Canvas Harness does not submit an assignment or change Canvas grades.
- Opening Desmos loads an external site. Canvas Harness does not send Canvas context to it.
- **Tools → AI** opens an AI website. Clicking **Send** inserts your question and the chosen course text into that provider's draft; optional automatic submission can also send the message. On first use, the browser may ask for that provider's optional site permission. You can always use **Copy** and paste manually. Grades and local GPA data are excluded from AI context.
- The package contains shared extension files, not the developer's private classes, assignments, grades, notes, account data or imported artwork. Never share your personal backup or private SVGs with a public release.

Read the full [Privacy notice](PRIVACY.md) before using third-party AI tools.

## Updates and backups

Before updating, use the workspace settings to export your own personal backup and keep it private. Replace extension files in the same installed folder, click **Reload** on the browser's Extensions page, then refresh Canvas. Avoid uninstalling when updating, because uninstalling can remove locally saved data.

After installing or updating, compare an assignment deadline with Canvas's original page. Canvas remains the authoritative source for due dates, submissions and grades.
