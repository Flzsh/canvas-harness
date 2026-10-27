# Get started with Canvas Harness

Canvas Harness 3.7.0: use Features in the popup for Full, Lite or Custom. The optional Market asks for its own site access on first use; Make it yours → More → Add from a file imports artwork, kits, themes, pets and presets. Modules progress and To hand in are included; Focus room, Review deck and Grade impact start off. Your school's own Canvas address is still added through the popup.

Use this guide after [installing in Chrome or Edge](../INSTALL.md). Canvas Harness uses your signed-in school Canvas account, so there is no separate Canvas Harness login or Canvas API token to enter.

## Open your workspace and check the connection

1. Sign in to your school's Canvas website, then refresh the page.
2. Open Home and check that the course list belongs to the account you intended to use.
3. Use the refresh button labeled **Refresh Canvas data**. Wait for the sync indicator to change from **Syncing with Canvas…** to a fresh **Synced with Canvas** timestamp.
4. Open one assignment and compare its due date and instructions with the original Canvas page. Read any unavailable-data or refresh-error notice before relying on that panel.

Canvas remains the source of truth for deadlines, submissions, and official grades. A local cache can show older information while a refresh is pending or has failed.

To return to Canvas's own interface, choose **Canvas dashboard** in the toolbar, or open the extension popup and choose **Open original Canvas**. You can also disable **Enable Canvas Harness on Canvas** in the popup and reload the page.

## Find the work and the teacher's information

Start with All courses for an overview of upcoming assignments. Choose a course for its work, teacher home page, recent announcements, and available course-associated message summaries.

Open an assignment to read its instructions in the workspace. Use Course hub for the teacher's course home and updates, Materials for available pages and files, and Messages for recent Canvas message summaries. If a page relies on embedded content or cannot be read here, follow its link to the original in Canvas.

Use **Show grades** when you want grades visible. It starts off. Hiding grades controls their display; it does not guarantee that grade data is absent from the local cache.

## Notice deadline changes

Choose **Changes** in the dashboard toolbar to see due dates that moved, were added or were removed since a previous successful refresh. The first refresh establishes the baseline. Failed course loads do not count as deadline edits. Enable or disable the feature in the popup’s Features page. [Details](deadline-changes.md).

## Select, complete, or bookmark

A small circle beside an assignment is a selection control. Clicking it selects the assignment; it does not immediately complete or submit it. The selection bar shows a count and the available actions.

| Action | Result |
| --- | --- |
| Click a selection circle | Select or deselect an item for a later action. |
| **Use in AI** | Open the AI tool with the selected coursework. |
| **Archive** | Mark the selected assignments done locally and remove them from Up next. This changes Canvas Harness only. |
| **Clear** | Clear the selection without archiving it or sharing it with AI. |
| **Bookmark** | Save an assignment or resource for later access. Its completion state stays the same. |

The bar confirms how many assignments were **archived in Canvas Harness** and offers **Undo**. You can also use **Undo mark done** on a locally completed item to put it back in Up next. Local completion does not submit homework, edit an assignment, or change a grade in Canvas. Use the assignment's original Canvas page to submit your work.

Bookmarks are available in the overview and the course workspace. Remove a bookmark when you no longer need the shortcut; that does not complete or delete the original item.

## Arrange your workspace

On Home, press and hold a course card or panel heading until it lifts, then drag to a highlighted destination and release. The lift happens after roughly half a second.

- Move a course card to change course order.
- Move a panel to the left or right of another panel to arrange them beside one another.
- Move a panel to the top or bottom of another panel to stack them.
- Choose **Undo move** to restore the previous arrangement.

Release ends the move. To move something else, start a new hold; dragging does not remain active between moves. Press **Esc** to cancel a move.

For keyboard moving, focus a panel's move grip and press **Space**. Use **Tab** to choose a target panel, the **arrow keys** to choose an edge, and **Enter** to place it. For a course card, focus it and press **Alt + Space**, use the arrow keys to reorder it, then press **Enter**. **Esc** cancels either kind of move.

Open **Appearance settings** for layout presets and smaller adjustments. Studio puts course information first; Study puts assignments first; Focus starts with a stacked layout. You can keep using the main page while the settings dock is open. See [Themes and artwork](THEMES.md) for surface, type, and motion choices.

## Give a course its own artwork

Canvas Harness includes 22 automatic subject presets and a general fallback. To create something for your own course:

1. Open the [artwork prompt](../skills/canvas-harness-art/PROMPT.md), copy the complete prompt into an AI assistant, and describe the course's topics, displayed name, and preferred color. An assistant that supports skills can use the [artwork skill folder](../skills/canvas-harness-art/README.md#using-it) instead.
2. Ask for one **.chpack** file containing the coordinated banner, icon, and frame. You can also try the [astronomy example pack](../skills/canvas-harness-art/examples/astronomy/astronomy.chpack).
3. Open **Appearance settings → Quick Upload** and choose or drop the pack. To paste it, open **Or paste a pack**, paste the complete output, and choose **Review pack**.
4. Check each preview and its **Apply to** course. Resolve an unmatched course using the selector, or uncheck that group. Uncheck any piece you want to leave out.
5. Choose **Apply N pieces**. Wait for **Artwork applied** before treating the changes as saved.

Reviewing a pack does not apply it. **Undo last pack** restores the most recently applied artwork while this workspace session remains open, provided the affected artwork and banner options have not since changed. It leaves unrelated preferences intact. If Undo reports a conflict, review your current art and restore an earlier personal backup if needed.

Quick Upload supports banners, icons, and frames. Use **Course artwork** below it for individual SVG uploads, including a separate custom title, or to restore a built-in drawing. More detail is in [Themes and artwork](THEMES.md#make-an-artwork-pack-with-an-ai-assistant).

## Use Tools beside an assignment

Choose **Tools** in the toolbar. The dock opens beside the main workspace, which remains usable.

**Calculator** provides Desmos graphing and scientific calculators. If the embedded calculator is blocked, use its **Open Desmos** link. Desmos is an external website, and Canvas Harness sends it no Canvas coursework.

**GPA** compares 4.0 and 4.3 estimates using your chosen courses and rules. Adjust credits, grade cutoffs and points, weighting bonuses, caps, or included courses. Use what-if grades to explore a scenario without changing Canvas. Missing grades are excluded. Revealing GPA in this tool does not turn on **Show grades** in the main workspace.

### Send selected text to an AI website

1. Select assignments or materials with their circles, then choose **Use in AI**, or open **Tools → AI**. An opened assignment starts selected by default, so check the selected sources.
2. Choose a provider. Use **Open website / sign in** to finish signing in on its website. Opening that website alone does not transfer your coursework.
3. Type your question. **Review text to share** shows the instructional content that will accompany it. Review and explicitly accept missing or shortened content when prompted.
4. Choose **Send**, or press **Enter** in the question box. **Shift + Enter** adds a line. If the browser asks for optional scripting and access to the chosen provider's site, allow them only if you want website insertion. If a separate permission page opens, return to Canvas Harness and choose Send again after granting access.
5. Look for the insertion notice, then check that the provider's draft contains your question and the intended material. Review and submit it there.

**Send automatically after inserting** is off by default. When enabled, it also tries to submit the newly inserted message; confirm the message in the provider's conversation. An insertion notice alone does not prove chat submission. If the result is uncertain, check the provider page before retrying.

Clicking Send transfers the text to the provider website even if its chat message has not been submitted yet. Read selected materials for names or private details first. Grades, GPA inputs, private planner notes, and submission records are excluded from the instructional context builder.

If insertion fails, or you prefer not to grant site access, use **Copy** and paste the prepared text yourself. If clipboard access fails, select the prepared text in the fallback box and copy it manually.

Small PDF text is extracted locally. **+ PDF** accepts a PDF from your device; attached assignment PDFs may also be included. Each file is limited to 2 MiB, 20 pages, and 60,000 extracted characters; combined context is limited to 100,000 characters. The handoff uses extracted text, not the original PDF file. Scanned pages may have no readable text, and protected or oversized files can fail.

Provider editors, school access policies, and browsers can change what works. See [Study with AI](../AI.md) for the complete limits and [Privacy](../PRIVACY.md) for what reaches third-party sites.

## Back up your personal workspace

Open **Appearance settings → All settings & backups → Export my backup**. Keep the downloaded file private: it can include your notes, preferences, bookmarks, and imported artwork.

Use **Import backup** to restore a backup for the same Canvas site and account. Import replaces the personal workspace with the saved one; **Undo last restore** provides recovery from the previous restore. Canvas data is refreshed separately.

Export a backup before a substantial artwork change or extension update. When updating, replace the installed extension files, use **Reload** on the browser's Extensions page, then refresh Canvas. See [INSTALL.md](../INSTALL.md#updates-and-backups). Avoid uninstalling during an update because removing the extension can remove local browser data.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| Canvas Harness does not appear | Confirm the extension is enabled, the browser permits unpacked extensions, and the site is an HTTPS Canvas subdomain of <code>instructure.com</code>. Refresh after installing. If your school uses its own Canvas address, add it in the extension's popup and allow that site when the browser asks. |
| Courses are missing or look stale | Sign in to the intended Canvas account, use **Refresh Canvas data**, read errors, and check the original Canvas page. Hidden courses can be restored in Appearance settings. |
| A teacher page, file, or message is unavailable | Follow the original Canvas link. School permissions, locked content, embedded pages, and recent-message limits can affect what appears here. |
| Clicking a circle did not complete an assignment | It selected the item. Choose **Archive** for local completion, or **Use in AI** for context selection. |
| A drag will not start | Hold a course card or panel heading until it lifts. Each move needs its own hold; try the keyboard controls above if needed. |
| An artwork pack cannot be applied | Resolve or uncheck unmatched course targets, read the validation and storage notices, then review the pack again. Title SVGs go through the individual uploader. |
| AI text was not inserted or a send is uncertain | Finish provider sign-in, check permissions and the provider's draft/conversation, then use **Copy** if insertion is blocked. Do not assume a failed notice means no text reached the site. |
| A PDF yields no context | Check its size and page limits and whether it is scanned or protected. Review the warning; provide readable text manually if appropriate. |
| The workspace is not usable | Choose **Canvas dashboard**, or use the popup's **Open original Canvas**. Disable the extension for Canvas and reload if necessary. |

For a public bug report, include your browser and extension versions, the failing action, and a screenshot with private information removed. Do not attach personal backups, real grades, coursework, or private SVGs. [Report an issue](https://github.com/Flzsh/canvas-harness/issues).

[Return to the README](../README.md)
