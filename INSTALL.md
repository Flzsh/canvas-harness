# Canvas Harness

Canvas Harness brings course information, assignments, bookmarks and study tools into one workspace, with animated artwork and consistent course layouts.

## Install in desktop Chrome or Edge

1. Extract this ZIP into a folder you will keep.
2. Open `chrome://extensions` or `edge://extensions`.
3. Turn on Developer mode, choose Load unpacked, and select the extracted folder containing `manifest.json`.
4. Disable other Canvas dashboard extensions while using Canvas Harness.
5. Sign in to your school’s Canvas with your own account and refresh the dashboard.

If your managed browser blocks unpacked extensions, ask your school's IT staff about permitted installation options.

## Data and privacy

- The ZIP contains application code, shared artwork, fonts, icons, and this guide. It does not contain the creator's Canvas account, grades, course enrolment list, messages, notes, saved settings, screenshots, or exported backups.
- Canvas Harness reads the courses and assignments available to the account signed into your school’s Canvas in your browser. It does not need a shared password or API key.
- Personal notes, bookmarks and checked-off work are saved locally, separated by Canvas account and site. Grades are hidden by default; you can enable your own grades.
- Canvas requests are read-only. Marking an item done in Canvas Harness does not submit schoolwork or change Canvas grades.
- Calculator loads Desmos when you open it. It is an external service; Canvas Harness does not pass Canvas account or course data to it.
- Tools → GPA estimates both 4.0 and 4.3 scales from available course grades. Reveal it separately, adjust credits and grading rules, and try clearly labeled what-if grades. It does not change Canvas grades or your official transcript.
- Tools → AI shares only the sources you select when you choose Inject or Send. Inserting a website draft shares that text with the selected provider before sending the chat. See [Study with AI](AI.md) for setup and limits. Website insertion and the optional local ChatGPT companion request their own permissions.
- Supports HTTPS Canvas school sites on `*.instructure.com`. Custom domains and self-hosted Canvas are not covered by this release. School permissions and Canvas configurations can differ.
- The popup detects the active Canvas tab. Otherwise, enter your school’s Canvas address. No shared password, account export, or API key is needed.

## Updates and backups

Open Customize workspace in the dashboard toolbar to change layout, course names/order, artwork, borders, colors and motion. Upload an SVG or expand Paste SVG to paste its source; templates are available beside each artwork slot. Use the All courses choice to customize the overview independently from individual courses.

Keep this folder in place. For updates, export your own notes backup first, replace files in the same extension folder, click Reload on the extension, and refresh Canvas. Do not uninstall to update. Do not send your personal backup when sharing the extension.

Compare one assignment deadline with original Canvas after installation. Use Canvas dashboard to return to the original page whenever needed.
