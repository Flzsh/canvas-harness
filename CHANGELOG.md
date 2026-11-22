# Changelog

## 4.1.0 - 2026-11-19

A Christmas scene, theme packs that can bring a moving band and a companion of their own, and AI help that fits Gemini's chat box.

- A new scene in Make it yours → Look → Scene, in the Holiday pack after Thanksgiving: **Christmas**, a market town on Christmas Eve in pixel art. Northern lights over the bakery, the town clock and a toy shop, the great tree with presents round it, a cabin among firs, deer by a frozen lake and falling snow, in an 18-second loop; below it, snow paper with frames of timber and snow. Biscuit knows it too: "christmas theme" or "xmas" switches to it.
- Theme packs can paint a band across the top of Home: one picture or short video with small moving pieces (snow, rain, leaves, lights and more), a picture of its own for Dark, one for narrow windows, and a companion of the theme's own that walks on Home while the theme is on. A pack made for a later version still installs, without its band.
- The Market installs a theme's band copy when it has one this version can show, and the plain theme otherwise.
- **Use default theme** in Make it yours → Look, and the built-in companion in Make it yours → Companion, now take you back from a theme or companion pack; before, they did nothing. The pack stays installed, ready to use again.
- AI help on Gemini: Gemini's chat box keeps only 32,000 characters, so Canvas Harness now fits each message to it. A message that still cannot fit is never typed, and you are told so plainly. Daily AI help's first reply is read as soon as it arrives, and a slow page gets longer to show a sent message.
- **On Canvas** off in the popup now takes Canvas Harness off every Canvas page; before, course pages kept the drawn course menu and the add-ons. An open Canvas tab reloads as plain Canvas, unless you have typed something in it. Switched on again, your add-ons come back as you chose them.
- AI help: with **Help** switched off in Edit Home, nothing is sent on its own, even after you chose **Every day**; what you ask for still runs. In the Help band, a small button beside **Daily AI help** shows how it runs, **Every day** or **When I ask**, and brings the two choices back.

## 4.0.0 - 2026-11-17

The first 4.0 release. From now on the Chrome Web Store and GitHub get the same package. Everything in 3.10.0 is in it, with a much smarter Biscuit, Canvas's menu bar redrawn for every window, a slip that undoes Archive and Mark done, Home modules that keep their shape, faster pages and many fixes, and AI help, which stays off and out of sight until you add it.

- AI help, as an add-on you choose: add **AI help** from the Market (extension popup → Market). It stays off, and nothing of it shows, until you add it.
- Adding it opens a short notice. Tick **I understand and agree** and choose **Turn on AI help**; **Not now** leaves it off, and **Use** on the add-on in Make it yours → More → Features shows the notice again.
- With AI help on: the Help band on Home with Help cards (practice tests, reading breakdowns, worked examples, writing outlines and more), Help with this on an assignment, a PDF or a selection, Daily AI help, Ask your AI and study aids in Tools → AI, through the AI website you pick or your own API key. Biscuit can hand it a question.
- Switching AI help off in Features, choosing Lite, or removing the add-on locks it again: whatever it was doing stops, and the notice asks again next time.
- The older AI handoff in Tools is now part of AI help. A saved choice that had it on stays off until you add AI help.
- Compared with 3.10.0 there is one more browser permission, alarms: while an AI help run is unfinished it keeps one alarm, so the run can go on. API sites (Anthropic, OpenAI, Google) are asked for only if you add your own key.
- Help band: opening Help no longer zooms or slides the scene above it. The scene stops where the Help band starts, the same as with Help closed.
- Help band: going to another tab and back to Home keeps the band and its cards as they were, instead of building them again. It also no longer reads the page's colours again each time a panel opens or the course dock moves, so Home opens sooner.
- Under Thanksgiving and Maple Wind, the Help band sits on paper, never on the painted picture.
- AI help asks the AI website much less: at most 20 messages an hour and 60 a day from all Canvas tabs together, Daily AI help on its own at most once an hour and three times a day, and a chat record read at most every 30 seconds. **Stop** ends a run everywhere (the AI tab, its timers, the worker) and keeps Daily AI help from starting by itself again that day; a click still runs it.
- AI help checks once that you are signed in to the AI website before it starts a chat, and on all eight AI websites it says plainly when you are signed out or have reached the site's usage limit, with a way back. A laptop that slept in the middle of a run no longer leaves it half done: the run waits for **Continue** and sends nothing more by itself.
- The Help band's **Stop** is a drawn button that stays beside its words at every width.
- Biscuit understands far more: a tool named alone opens it ("calculator"), "any tests this week" lists the tests ahead, "did I turn in ..." with several matches lists them, and his answers are cards and lists you can act on (open, plan, mark done, undo). A question never changes anything.
- Canvas's own menu bar is one tidy bar across the top or a rail down the side, at every window size and zoom: the selected item is a tinted pad, badges sit on their item and extra items fold into **More**. Over a scene it is on its own paper.
- Archive and Mark done leave a small slip that says what changed, with **Put back** for each item and **Undo all**. It comes folded to one line, opens with **Show**, and lies above Biscuit.
- Selecting work no longer makes the banner shrink and grow.
- Home modules keep their shape when you move or resize them, snap to their neighbours, and **Undo move** puts back the place and the width.
- Maple Wind paints the whole page below the banner, not only the banner. Starfield's stars follow the pointer from further away.
- With the Canvas menu as a drawer beside a scene, the scene stays under it and only the dashboard moves aside.
- Right after a school sign-in the dashboard opens by itself instead of leaving Canvas's own cards: Canvas Harness tries again quietly when Canvas still says "not signed in" or the network is waking, and checks again when you come back to the tab.
- Faster: Tools and Home keep their date formatters, pictures and frames ignore style changes that cannot hide them, and the page reads before it writes when it reveals new content. The selection bar follows the window on a long list, and a selection can hold 200 items.
- Fixes from a check of every page, theme and setting, among them: practice quizzes can be bookmarked and planned, the New chip counts only the chosen course, the Assignments page's day filter returns to All, the PDF reader opens a PDF whose header is not its first byte, Grade impact names a pretend quiz "Quiz", the Market says when a pack needs a newer Canvas Harness, the module size menu saves again, the Bookmarks shelf shows its names, the Grades sheet no longer slides over Grade impact, and Biscuit no longer fails on help lines while AI help is locked.
- Under Thanksgiving and Blueprint, the date, a course's links and More views each sit on their own slip of paper or pane, so the words stay readable over the picture. Blueprint's filter strip and week are denser for the same reason.
- From a 4.0 Preview: Your AI is now AI help and starts off. Add it from the Market and agree to its notice to use it again. Everything in 3.10.0 (below) is new to the previews too. The browser shows version 4.0.0, which replaces 3.99.x.
- Thanks to @DorjieQ for Biscuit's language training rounds 7 and 8 (#68).

## 3.10.0 - 2026-11-09

- Two new scenes in Make it yours → Look → Scene: Thanksgiving, a carved block print of a harvest evening on the farm, and Maple Wind, an autumn wood in the wind. The scenes are sorted into packs: Holiday, Seasonal and Everyday.
- Every scene fits the strip above Home's first widget at any window size, instead of being cut in half by the widgets. Under the Sea, Starry Night and Blueprint are repainted wide for it, and Starfield's sky keeps its shape as the window changes.
- Deadline changes is redrawn: each change is a small card with the course, the assignment, the old date struck through and the new one, and the day it was seen. Mark all read, and a drawn x to close.
- Under a scene, the tools on the right of the top bar sit together in one band like the tabs on the left, and are easier to see. The Changes count is a small tag.
- Refresh turns its own arrows while it syncs, instead of widening the button.
- Faster: a tab, view or course in the dock looks chosen the moment you press it, the drawings keep moving when you click, Biscuit waits until the page has drawn before he thinks, and Home no longer grows in memory as you click around. On battery, the drawings update less often.
- With the course menu as a drawer, the page beside it on a themed Home takes the theme's colour instead of white.
- Make it yours → More: Reload Canvas is a drawn button.
- Thanks to @DorjieQ for Biscuit's language training rounds 7 and 8 (#68).

## 4.0 Preview 6 - 2026-11-05

Version 3.99.6 in the browser.

- Focus room, Review deck and Grade impact are on from the start, in Full. They were in the package already but switched off until you chose them under Features. Lite still leaves them out, and Custom can switch any of them off.
- The Assignments page opens on All: every assignment in the course, late work first (newest first), then work by its deadline with new work leading, then work without a date, work waiting for a grade, and the done work kept as history, newest first. Up next, Today, Week and My plan are still there, and Home still opens on Up next.
- A course keeps its colour when you move it in the course list.
- Starfield: the course pictures sit inside their rows, and the sky fills the page behind Home.
- Play tools: a dealt tool's rays stay clear of the words on its card, and every card, of every rarity, gets a drawn outline that draws itself on and catches the light.
- A Help card sent through your AI website no longer waits on its slowest thinking level: when you have not chosen a level and the site is set above Extra high (ChatGPT Pro, Claude Max), that send goes at High, and the site's own level comes back after it.

## 3.9.3 - 2026-11-05

- Focus room, Review deck and Grade impact are on from the start, in Full. They were in the package already but switched off until you chose them under Features. Lite still leaves them out, and Custom can switch any of them off.
- The Assignments page opens on All: every assignment in the course, late work first (newest first), then work by its deadline with new work leading, then work without a date, work waiting for a grade, and the done work kept as history, newest first. Up next, Today, Week and My plan are still there, and Home still opens on Up next.
- A course keeps its colour when you move it in the course list.
- Starfield: the course pictures sit inside their rows, and the sky fills the page behind Home.
- Play tools: a dealt tool's rays stay clear of the words on its card, and every card, of every rarity, gets a drawn outline that draws itself on and catches the light.

## 4.0 Preview 5 - 2026-11-04

Version 3.99.5 in the browser. Two fixes for Preview 4.

- Make it yours → More shows its feature switches as drawn rows again. The page-start list of stylesheets left out their styles, so the list showed unstyled, with full-size drawings.
- Picking a scene theme no longer flashes its picture at full size and pushes Home down for a moment: the sky and the course pictures wait until the theme's own styles have loaded.

## 4.0 Preview 4 - 2026-11-04

Version 3.99.4 in the browser.

- Sidebar: each course row is as tall as its own content needs. With only a few courses the spare height stays below the last one instead of stretching every card's frame long and empty.
- Home and the Course hub beside the docked PDF reader lay themselves out for the room they have instead of being shrunk to fit; Canvas's own pages are still zoomed.
- The course dock keeps to the room beside a docked reader, and course names in it no longer break in the middle of a word.
- The reader's text and a Materials page keep the mouse wheel only while they have something to scroll; otherwise the page under them scrolls.
- The drawn pen lines around groups in Make it yours are back, and the pen-eased motions (a Review deck card turning, among others) run again.
- Make it yours → More lists the features you installed from the Market. Before, it said "Could not load installed features."
- Your AI: Send is found on ChatGPT and Claude even while it is still fading in, in a tab in the background. When the message reached the AI tab but was not sent, the band says so.

## 3.9.2 - 2026-11-04

Two fixes for 3.9.1.

- Make it yours → More shows its feature switches as drawn rows again. The page-start list of stylesheets left out their styles, so the list showed unstyled, with full-size drawings.
- Picking a scene theme no longer flashes its picture at full size and pushes Home down for a moment: the sky and the course pictures wait until the theme's own styles have loaded.

## 3.9.1 - 2026-11-04

3.9.0 kept the look of 3.8. This release brings everything from 4.0 Preview 4 except the 4.0 daily AI (the Help band, Prepare, Daily AI help and Overnight). The AI context and handoff in Tools stay as they were in 3.9.0, with the same permissions.

- The top bar is drawn: each tab has its own drawing beside its name, and the search reads Find work. In half and quarter windows the words give way to the drawings, and each tab shows its name as a tooltip. The course dock and the top bar scroll the same way.
- Make it yours is laid out in five tabs: Look, Home, Courses, Companion and More. More holds the drawn feature switches (Full, Lite or Custom) and the daily preferences such as the time zone, and a course's drawing can be chosen from the subject sets.
- Graphics, in Make it yours → Look: Low, Medium, High and Extra high. Each step down leaves out the detail that is seen least, and Advanced tunes one kind at a time. Slower computers start on Medium.
- New since your last visit: a New chip and view for work Canvas added and grades that came back since you last looked.
- An overdue item's details say what handing it in now costs, from the course's late policy, or, when Canvas keeps that from students, from your own earlier late work there.
- A heavy day is marked in words on the day strip and in Planner. Easy read in Reading text uses plainer letters.
- Biscuit reads a line with a written rule list first. A plan is built around what you name, including homework Canvas does not know about, and Canvas's list is a suggestion rather than the plan. Make it yours → Companion has Full and Lite. Biscuit wakes with the B key.
- When Biscuit hands a question to an AI, scores you earned are taken out of the text unless grades are shared, as in 4.0.
- Sidebar: each course row is as tall as its own content needs. With only a few courses the spare height stays below the last one instead of stretching every card's frame long and empty.
- Home and the Course hub beside the docked PDF reader lay themselves out for the room they have instead of being shrunk to fit; Canvas's own pages are still zoomed. The course dock keeps to that room, and course names in it no longer break in the middle of a word.
- The reader's text and a Materials page keep the mouse wheel only while they have something to scroll; otherwise the page under them scrolls.
- The drawn pen lines around groups in Make it yours are back, and the pen-eased motions (a Review deck card turning, among others) run again.

## 4.0 Preview 3 - 2026-11-02

Version 3.99.3 in the browser.

- Your AI: choose the AI in the Help band, beside Daily AI help. A newly chosen website asks for its own access once, when you pick it.
- Your AI: a thinking effort choice beside it for ChatGPT (Instant to Extra high) and Claude (Low to Extra). It is set for Canvas Harness's own message and the site's own choice is put back after sending. Left on Thinking, the site's choice is not touched. Claude's Max is never chosen, because it costs several times the usage.
- Help cards: a writing outline for an essay, a lab report or a discussion post. It gives the question the thesis has to answer, the sections in order with what each has to do, and where in the material the evidence is. The student writes the thesis and the piece.
- Help cards show up in the band as each one is made, and the band turns to the first new card once. An item that gets no card is named under the band's buttons with the reason, in the AI's own words when it gave one.
- Your AI reads more of each item: files up to 30,000 characters, the whole rubric, whole pages from the start and end of a long PDF, and a brief for that item's course alone. Files from the same module are listed first among the ones the AI can ask for. Whatever is cut or cannot be read is named, so the AI does not guess.
- Your AI's message says that everything taken from Canvas is material to use, never instructions to follow.
- When the AI website reaches its usage limit, the run stops, keeps the cards already made, and the band shows the site's own sentence.
- A sleeping or closed AI tab no longer leaves a run hanging. On ChatGPT and Claude the reply is read from the chat's record; otherwise the band offers Open chat. A message that may have been sent is never sent again on its own.
- When Canvas signs you out, or no Canvas page answers for two minutes, the band shows Refresh Canvas, which reloads Canvas and carries on.
- From a test on made-up courses: a short requirement inside a long paragraph of instructions is no longer cut, a "password is" line is removed, and checkpoint dates and "post before you see replies" reach Help.
- Your AI works across many more Canvas setups. A course or tab Canvas refuses is named to the AI and the run goes on, and no courses at all means nothing is sent. Quizzes, outside tools, locked items, picture-only instructions, discussion prompts and checkpoints, redo requests and work with no due date all reach it correctly, and links in every form Canvas writes are followed. Whatever could not be read is named, so the AI is told not to guess.
- Your AI: login lines and email addresses are now removed from everything added for an item, not only from the brief.
- The Help band keeps its rows lined up at every width: its parts wrap to set rows, and card text lines up.
- Graphics, in Make it yours → Look: Low, Medium, High and Extra high. Each step down leaves out the detail that is seen least, and Advanced tunes one kind at a time (moving drawings, room life, course frames, room detail, the banner drawing, framed course cards). A computer with four cores or fewer, or 4 GB of memory or less, starts on Medium and says so once.
- Biscuit reads a line with a written rule list first. A plan is built around what you name, including homework Canvas does not know about, and Canvas's list is a suggestion rather than the plan. Make it yours → Companion has Full and Lite; Lite leaves out the trained language pack, for lighter laptops. The pack now loads only when Biscuit is first opened. The separate more-rules add-on is gone; Full has its rules.
- New since your last visit: a New chip and view for work Canvas added and grades that came back since you last looked.
- An overdue item's details say what handing it in now costs, from the course's late policy, or, when Canvas keeps that from students, from your own earlier late work there.
- A heavy day is marked in words on the day strip and in Planner. Easy read in Reading text uses plainer letters.
- PDF reader: a reading ruler (L).
- Developer tools, off until you switch it on: a read-only tab in Tools with the build, what is switched on, the settings you changed, the Canvas sync, speed, storage and errors from Canvas Harness's own files. **Copy report** puts it on your clipboard for a bug report, without names, coursework or your school address. Thanks to @hellyeahboys666 for the idea in #65.
- Play tools run much lighter on long pages: words or runs of words are cut only where a tool reaches, and each tool reads the page once per gesture. Foil now works on long pages.
- Play tools take the whole page: pictures, icons, buttons and fields go with the words, and under Gravity so do ruled lines and list bullets. Put it back brings everything home.
- Gravity has one apple. It lands where you click, and the faster you drag it the harder the page falls; its arrow shows how hard.
- Hammer cracks are softer, Magnet holds letters around it like filings, and Ink, Painter and Eraser are redrawn. In Garden the words themselves grow stems, leaves and flowers.
- The tool you are dealt comes from a full rarity list, Common to Legendary, each with its own chance out of 100. Its band shows on the card.
- A Chromebook or a small laptop gets the same tools at a lighter cost, with nothing to turn on.
- Black hole grows behind the page before it breaks through. A drawn disk and a cloud of light then pull in everything on the screen, the menus and sidebars too, and the page is empty when it closes.
- Foil sweeps a film in the foil card's own colours over the page before it folds it flat. Bomb's fire is painted, and Railgun's shot is one beam of light that cuts a lit valley.
- Laser: every closed part of a cut drops out, a fast swipe cuts everything it crosses, and a picture parts along the beam.
- Balloons rise from wherever you click and carry off the nearest words. Portals pull in the words around them, not only words you drag through. Painter's paint dries in about a second and a half.
- Badges and icons go with the words. An open Canvas menu stays where it is while a tool runs, and its hidden hover cards no longer fly as empty frames.
- Every window size: the top bar stays one row in half and quarter windows, its words giving way to its drawings, and each tab shows its name as a tooltip. Tools and Make it yours float over the page below 1720 px. A short window keeps the heading to one line, and the pony is smaller in a small window.
- Grades: All courses shows Grade impact's Coming up strips again.
- A part of Canvas that a teacher hid no longer stops a whole load, and courses that have not opened yet are left out.
- Focus room: its sound starts with your first press in the room.
- Canvas's own pages: the side buttons are drawn with the pen line, and Canvas's phone menus stay inside the window.
- Modules: a module's name keeps its room when Tools is open beside the page, and your progress shows again at once when you come back.
- Course hub: pages a teacher has not shared no longer show as errors.

## 3.9.0 - 2026-10-31

- Review deck: redrawn as a reading room that grows out of its Home module and folds back into it. The module comes in three sizes, and the large one lets you study right there.
- Grade impact: redrawn as a weighing room for one course, opened from Grades or its Home module. Pretend assignments you add stay in this browser and are never sent to Canvas.
- Focus room: redrawn with four drawn places and their sounds. Its Home module has the seal, +5, Finish and Break.
- Those three stay off until you switch them on: Features in the popup, then Custom.
- Play tools run much lighter on long pages: words or runs of words are cut only where a tool reaches, and each tool reads the page once per gesture. Bomb, railgun and black hole still break into letters.
- Foil now works on long pages: it smears the letters nearest its line and whole words beyond them.
- Marks and physics rest after 2 minutes without input, like the rest of the drawings.
- Play tools take the whole page: pictures, icons, buttons and fields go with the words, and under Gravity so do ruled lines and list bullets. Put it back brings everything home.
- Gravity has one apple. It lands where you click, and the faster you drag it the harder the page falls; its arrow shows how hard.
- Hammer cracks are softer, Magnet holds letters around it like filings, and Ink, Painter and Eraser are redrawn. In Garden the words themselves grow stems, leaves and flowers.
- The tool you are dealt comes from a full rarity list, Common to Legendary, each with its own chance out of 100. Its band shows on the card.
- A Chromebook or a small laptop gets the same tools at a lighter cost, with nothing to turn on.
- Every window size: the top bar stays one row in half and quarter windows, and the tabs scroll sideways when it runs out of room. Tools and Make it yours float over the page below 1720 px. A short window keeps the heading to one line, and the pony is smaller in a small window.
- A part of Canvas that a teacher hid no longer stops a whole load, and courses that have not opened yet are left out.
- Black hole grows behind the page before it breaks through. A drawn disk and a cloud of light then pull in everything on the screen, the menus and sidebars too, and the page is empty when it closes.
- Foil sweeps a film in the foil card's own colours over the page before it folds it flat. Bomb's fire is painted, and Railgun's shot is one beam of light that cuts a lit valley.
- Laser: every closed part of a cut drops out, a fast swipe cuts everything it crosses, and a picture parts along the beam.
- Balloons rise from wherever you click and carry off the nearest words. Portals pull in the words around them, not only words you drag through.
- Painter's paint dries in about a second and a half, so the words it wakes stay in view.
- Badges and icons go with the words. An open Canvas menu stays where it is while a tool runs, and its hidden hover cards no longer fly as empty frames.
- Focus room: its sound starts with your first press in the room.
- Canvas's own pages: the side buttons are drawn with the pen line, and Canvas's phone menus stay inside the window.
- Modules: a module's name keeps its room when Tools is open beside the page, and your progress shows again at once when you come back.
- PDF reader: a reading ruler (L).
- Course hub: pages a teacher has not shared no longer show as errors.
- Developer tools, off until you switch it on: a read-only tab in Tools with the build, what is switched on, the settings you changed, the Canvas sync, speed, storage and errors from Canvas Harness's own files. **Copy report** puts it on your clipboard for a bug report, without names, coursework or your school address.

## 4.0 Preview 2 - 2026-10-30

Version 3.99.2 in the browser.

- Your AI: when a run stops, the Help band says so. The progress track no longer stays frozen on its last step beside the message, which looked like a stuck run.
- Your AI: a new "updated" time on a Canvas assignment no longer stops a run, because the newest text is read at that moment anyway. A source that has been locked or unpublished still stops it.

## 4.0 Preview 1 - 2026-10-29

A test build of 4.0 for people who want to try it early and send fixes. Version 3.99.1 in the browser, so the real 4.0.0 replaces it.

- Your AI: Help cards for an assignment, a PDF's pages or a selection; Today on Home; Prepare reads your courses and builds cards ahead of time; study aids (practice test, reading guide, lab checklist, rubric check, fixes, notes, steps, outline, message, summary, flashcards) saved beside their assignment. Answers come from the AI website you choose in its own tab, from an API key you add, or from your own AI tool through a folder you pick (Overnight). Off in Lite. Nothing goes to an AI until you press a button, unless you choose **Every day**: the Help band asks once, and **Prepare every day** in Tools → AI changes it later. The brief names only Inbox messages from teachers and TAs, teacher comments go only with **Teacher feedback** on (never your own), and on ChatGPT and Claude only the chat Canvas Harness started is opened to read its reply.
- Biscuit can hand a question to Your AI with the item you are on, wakes with the B key, and offers help at sensible moments (never while Quiet is on).
- Review deck, Grade impact and Focus room open as rooms over Home, which stays in place; a room you used before opens at once.
- Review deck: Big card (B), and the box tabs no longer overlap.
- Focus room: the four places are redrawn and a fifth, Winter, is added. Sound starts only after you click.
- Grade impact: the answer comes first, with a ruler showing now and if; pretend assignments in your course's categories stay on this device; scores can have decimal points. On Grades, a course's name opens its Grade impact room.
- Make it yours: a Settings tab (time zone, backups, keyboard shortcuts) and a Features tab with drawn switches; choose a course's drawing from the subject sets.
- The top bar is drawn; the course dock and the top bar share one scrolling model.
- Start-up waits for the add-ons while they load, and Canvas shows as soon as you use its page.
- Works for any school: every address goes through the school-address setting, and pages on your school's address that are not Canvas are left alone.

## 3.8.1 - 2026-10-29

- Modules page: the progress line (count, bar, Hide finished and Continue) is spaced out instead of squeezed together, and Retry only shows after loading fails. Each module's count, bar and Mark all done sit apart on its label. Each item's tick has its own space instead of covering the item's icon, and an item not yet done shows a drawn ring instead of Canvas's "unpublished" sign. Hide finished looks pressed while it is on.

## 3.8.0 - 2026-10-28

- The PDF reader uses PDF.js's modern build. A small, readable polyfill file adds the few newer built-ins it calls, so Canvas Harness needs Chrome or Edge 126 or newer (3.7.0 needed 120).
- Source code is laid out one statement per line (whitespace only), and the release check keeps it readable.
- Biscuit understands short typed lines far better, from a new round of its language rules. It still runs on your computer; no AI.
- PDF reader: a text box that goes over a file's mark limit stays open with its words; text size and colour chosen while typing apply to that box; a copy with marks is never saved once the reader is hidden or closed; a module PDF read in the reader counts as opened. Thank you @garywu000 for issues #58, #59, #60 and #61.
- The page does much less work while nothing changes: saving unchanged data, the minute timer and coming back to the tab no longer redraw it, a redraw that changes nothing writes nothing, and the pony draws on the drawings' clock. Measured against 3.7.0 in a test browser, the idle page restyles half as often (25 times a second instead of 52) and switching courses paints in 117 ms instead of 150 ms.
- Drawings keep moving while you scroll and rest after 2 minutes without input (it was 25 seconds). The small ornaments on the course frames now stand in their drawn pose: their loops made slow computers noticeably slower (on a computer four times slower, clicks took about 90 ms longer and twice as many frames came late while scrolling). The course art stylesheet is 168 KB smaller.
- Privacy: from your Canvas profile, only your name and account ID are saved on the device; the rest of the profile (email address, login and SIS IDs, picture, calendar feed address) is no longer cached. PRIVACY.md now says so.

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
