<h1 align="center">
  <img src="docs/media/banner.gif" width="880" alt="Canvas Harness, a browser extension for Canvas LMS: a hammer knocks a lobe out of the gear, the subjects line up and the name is painted in; then the same picture is repainted as the sea, Starry Night, a starfield and a blueprint">
</h1>

<p align="center">
  <b>A free Chrome and Edge extension that redraws Canvas LMS for students.</b><br>
  Open your school's Canvas as usual and it becomes one calm page:<br>
  everything due beside its instructions, in a workspace you arrange and draw your way.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/bppjpjpbichfcbgajlppkgbbncbfohgd"><img alt="Chrome Web Store" src="https://img.shields.io/chrome-web-store/v/bppjpjpbichfcbgajlppkgbbncbfohgd?label=Chrome%20Web%20Store&color=C96442"></a>
  <a href="https://github.com/Flzsh/canvas-harness/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/Flzsh/canvas-harness?label=release&color=C96442"></a>
  <img alt="A Chrome and Edge extension for Canvas LMS" src="https://img.shields.io/badge/for-Canvas%20LMS-3D3D3A">
  <img alt="Works in Chrome and Edge" src="https://img.shields.io/badge/Chrome%20%C2%B7%20Edge-extension-3D3D3A">
  <a href="LICENSE"><img alt="License: GPL-3.0-only" src="https://img.shields.io/badge/license-GPL--3.0--only-5E7F45"></a>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/bppjpjpbichfcbgajlppkgbbncbfohgd"><b>Add to Chrome</b></a> ·
  <a href="https://github.com/Flzsh/canvas-harness/releases/latest">Download</a> ·
  <a href="INSTALL.md">Install</a> ·
  <a href="PRIVACY.md">Privacy</a>
</p>

> [!IMPORTANT]
> **This is the `preview/4.0` branch: Canvas Harness 4.0 Preview 2, a test build.** It is ahead of the Chrome Web Store version and may have rough edges. For everyday use, install the [store version](https://chromewebstore.google.com/detail/bppjpjpbichfcbgajlppkgbbncbfohgd) or the [latest stable release](https://github.com/Flzsh/canvas-harness/releases/latest).
>
> **Install the preview.** Download `Canvas-Harness-4.0-Preview-2.zip` from the preview release, unzip it, open `chrome://extensions` (or `edge://extensions`), turn on Developer mode, choose **Load unpacked** and pick the unzipped folder. It shows as version 3.99.1, "4.0 Preview 2", so the real 4.0.0 replaces it later. Remove the store version first, or turn it off, so the two do not both run on Canvas.
>
> **What is new:** Your AI (Help cards for an assignment, a PDF or a selection; Today; Prepare; study aids saved beside their work; your AI website or an API key; an optional overnight run), Biscuit handing questions to Your AI and waking with B, rooms for the Review deck, Grade impact and Focus room over Home, the Big card, a redrawn Focus room with Winter, Grade impact that answers first with pretend assignments and decimal points, a drawn top bar, and Settings and Features tabs in Make it yours. [Every change](CHANGELOG.md)
>
> **Found a problem?** [Open an issue](https://github.com/Flzsh/canvas-harness/issues/new) and say it is about 4.0 Preview 2: what you did, what you expected, and your browser. **Want to fix something?** Send a pull request against the `preview/4.0` branch, with `npm test` and `npm run check` passing.

<table>
<tr>
<td width="50%" valign="top"><img src="docs/media/home.gif" width="100%" alt="Switching on Home modules and dragging one into a full-width row"><br><b>Your Canvas Home, rebuilt</b><br><sub>Pick the modules you want and drag them into place.</sub></td>
<td width="50%" valign="top"><img src="docs/media/planner.gif" width="100%" alt="Typing a task that lands on Friday with a 45 minute estimate"><br><b>Plan the week</b><br><sub>Your Canvas assignments, with your own tasks: type “essay fri 45m” and it lands on Friday.</sub></td>
</tr>
<tr>
<td valign="top"><img src="docs/media/pdf-reader.gif" width="100%" alt="A PDF opening beside the course page, with a highlight and a margin note"><br><b>Course PDFs beside your work</b><br><sub>Open a Canvas file, then highlight, note and mark up without a new tab.</sub></td>
<td valign="top"><img src="docs/media/make-it-yours.gif" width="100%" alt="Make it yours: choosing a layout, a page colour and an outline by picture"><br><b>Make it yours</b><br><sub>Every choice is a picture: layout, colour, type, outline.</sub></td>
</tr>
<tr>
<td valign="top"><img src="docs/media/themes.gif" width="100%" alt="The workspace switching between the Under the Sea, Starry Night, Starfield and Blueprint themes"><br><b>Themes</b><br><sub>Under the Sea, Starry Night, Starfield and Blueprint.</sub></td>
<td valign="top"><img src="docs/media/biscuit.gif" width="100%" alt="Biscuit the pony walking along the modules and answering a short request"><br><b>Biscuit</b><br><sub>A small pony that knows what is next. One switch turns it off.</sub></td>
</tr>
</table>

<p align="center"><sub>Every demo is Canvas with Canvas Harness switched on, using made-up courses and assignments.</sub></p>

## New in 3.8

- **Biscuit understands short lines far better**, still on your computer with no AI.
- **PDF reader fixes**: a text box keeps its words when a file is full of marks, text size and colour apply to the box you are typing in, and a module PDF you read counts as opened.
- **Lighter when idle**: the page restyles half as often while nothing changes, and drawings keep moving while you scroll.
- **Mozilla's standard PDF.js build**, so it now needs Chrome or Edge 126 or newer.

Also in 3.7: a course dock you can move and resize, and a Cards look. Thanks to @garywu000 and @HarryX081125 for their contributions. [Every change](CHANGELOG.md)

## Install

**Chrome Web Store:** [Add to Chrome](https://chromewebstore.google.com/detail/bppjpjpbichfcbgajlppkgbbncbfohgd). Edge can install it from the same page. It updates by itself.

**From GitHub:** download the ZIP from the [latest release](https://github.com/Flzsh/canvas-harness/releases/latest), open `chrome://extensions`, turn on Developer mode and choose **Load unpacked**.

Works on `*.instructure.com` and on your school's own Canvas address once you add it in the popup. Needs Chrome or Edge 126 or newer. [Help](INSTALL.md)

## Privacy

Everything you make stays in your browser: no ads, no analytics, no server of ours. It never changes submissions or grades. [Details](PRIVACY.md)

<p align="center">
  <a href="docs/GETTING-STARTED.md">Guide</a> ·
  <a href="docs/THEMES.md">Themes</a> ·
  <a href="docs/TESTING.md">Tests</a> ·
  <a href="https://github.com/Flzsh/canvas-harness/issues">Report a bug</a>
</p>

<p align="center"><sub>Made by Flzsh · <a href="LICENSE">GPL-3.0-only</a> · <a href="extension/NOTICE.txt">Third-party notices</a><br>
An independent project, not affiliated with or endorsed by Instructure. Canvas is a trademark of Instructure, Inc.</sub></p>
