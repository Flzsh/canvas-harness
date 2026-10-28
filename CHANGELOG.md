# Changelog

## 3.7.0 - 2026-10-27

- Course dock: drag the shelf to move it and its top edge to resize it; right-click for its card.
- Cards look: each course on a small card with its name and what is due next.
- Shelf, motion and name choices; Biscuit can change them too.
- The PDF reader opens again in current Chrome and Edge. Since 3.5.0 it waited for a reader frame it could not recognise and fell back after 20 seconds.

## 3.6.0 - 2026-10-27

- Make it yours redrawn, and its tabs switch several times faster.
- Top bar redrawn.
- Biscuit settings now save and apply, including a bedtime after midnight.
- Fix Canvas showing after leaving a tab during loading.

## 3.5.0 - 2026-10-25

- My links & files keeps your course links and uploaded files on this device, with in-workspace viewers and bounded backups. Thank you @garywu000 for pull request #47.
- Copy PDF text marks as study notes or download a Markdown study sheet, with literal document text, safe filenames and an account check before downloading. Thank you @garywu000 for pull request #51.
- Changes in the toolbar lists observed deadline changes, with an unread count and history kept locally per account. Full includes it; Lite leaves it out. Thank you @garywu000 for pull request #52.
- PDF mark-up adds strike-through, highlighter pen, text boxes, shapes, redo, a Marks list and nine drawn tool icons. Reading position and tool choices stay on the device. Thank you @HarryX081125 for your work in issue #53.
- Make it yours now has Look, Home, Courses, your companion and More. Artwork lives with Courses, imports and resets live in More, and the panel remembers the last tab. Controls use their drawings and names.
- Biscuit understands short typed lines much better ("calc hw", "tmrw", "focus 25", "open planner") and offers the likely matches to pick when a line could mean several things. It all runs on your computer; no AI.
- The dashboard opens faster on slower laptops. The course picker no longer covers the greeting while settings are open, and the PDF find box's magnifier is no longer cut off.

## 3.4.0 - 2026-10-21

- Use your own picture or short video as a banner, framed the way you want. Upload, drop or paste artwork for the heading, a course, card art or a dimmed page background. Fit, focus, zoom, height, video loops and stills carry into kits and backups; pictures and videos stay in your browser.

- Biscuit understands focus time in more ways, pomodoros and breaks, reminders, Planner blocks, timer controls and what is due. Ask for settings, features, Home modules, tabs, notes, bookmarks or a play tool by name. Routines, skills and quiet time are yours to choose; Undo is close by.
- Submitting work can bring a drawn scene and one random play tool. Powerful tools are rarer and get their own reveal.
- Four scene themes: Starry Night, Under the Sea, Starfield and Blueprint. Courses can sit in a drawn dock, with a choice of sizes.
- The optional Market installs checked add-ons, course artwork, kits, themes, pets and presets. Make it yours also accepts files you make yourself; installed add-ons have a Remove button.
- Modules show your progress, and To hand in keeps unfinished submissions in sight. Focus room, Review deck and Grade impact are available in Custom and stay off in Full and Lite. Thank you @garywu000 for your pull requests, including the menu-bar jump fix.
- Fixed the pony's resize guard, marks that moved away during a black-hole shake, white outlines on play letters, and the PDF reader closing after a failed lookup. Starfield's pointer reaches a smaller area.
- Your saved choices, artwork, notes and plans carry over. Lite leaves out scenes, play and media playback; saved artwork stays in your backups. The Market asks for its own optional site access the first time you open it.

## 3.2.1 - 2026-10-21

- With the course strip across the top, the banner, the course strip and Home scroll together as one page. Home modules are as tall as their content, so nothing scrolls inside a module.
- Scroll anchoring stays off for everything inside the workspace, not only the column (from @garywu000's #38).

## 3.2.0 - 2026-10-21

- Added Features in the popup: Full, Lite and Custom with automatic dependencies. Full preserves the existing feature set; disabled features keep their saved data.
- Kept the early opening screen and drawn navigation static; the worker loads the remaining selected packaged scripts in their original order. Required scripting permission replaces optional scripting; no other permission or host was added.
- Fixed content startup when the browser runs it before its shared scripts, the pony crash on window resize or when fonts finish loading, column scroll anchoring and navigation in tabs left open across an update.
- Retained 3.1 local artwork packs in the Features catalogue, with paste, file and drop review, apply and undo.
- Expanded PDF opening across Canvas files, modules and course content, including Materials and Linked materials; explicit Download links keep Canvas behavior.
- Fitted the topbar workspace to the window, contained long Home modules, moved its banner above the course strip, and hid the active Canvas footer and wrapper scrollbars.
- Added safe pony waiting, toolbox AI close handling, and applicable account-write, lazy-panel and render caching improvements.
- Removed the dashboard's outer white band and rounded corners and added an encoding regression check.

Created by Flzsh. [Chrome Web Store](https://chromewebstore.google.com/detail/bppjpjpbichfcbgajlppkgbbncbfohgd).
