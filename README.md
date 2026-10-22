<h1 align="center">
  <img src="docs/media/banner.gif" width="880" alt="Canvas Harness: a hammer knocks a lobe out of the gear, the school subjects fly out and line up, and the name is painted in">
</h1>

<p align="center">
  <b>A Canvas workspace you build yourself.</b><br>
  Inspired by AI harnesses: find your work faster, plan your week, and make Canvas comfortable to use.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/bppjpjpbichfcbgajlppkgbbncbfohgd"><img alt="Chrome Web Store" src="https://img.shields.io/chrome-web-store/v/bppjpjpbichfcbgajlppkgbbncbfohgd?label=Chrome%20Web%20Store&color=C96442"></a>
  <a href="https://github.com/Flzsh/canvas-harness/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/Flzsh/canvas-harness?label=release&color=C96442"></a>
  <img alt="Works in Chrome and Edge" src="https://img.shields.io/badge/Chrome%20%C2%B7%20Edge-Manifest%20V3-3D3D3A">
  <a href="LICENSE"><img alt="License: GPL-3.0-only" src="https://img.shields.io/badge/license-GPL--3.0--only-5E7F45"></a>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/bppjpjpbichfcbgajlppkgbbncbfohgd"><b>Add to Chrome</b></a> ·
  <a href="https://github.com/Flzsh/canvas-harness/releases/latest">Download</a> ·
  <a href="INSTALL.md">Install</a> ·
  <a href="docs/GETTING-STARTED.md">Get started</a> ·
  <a href="PRIVACY.md">Privacy</a>
</p>

<p align="center">
  <img src="docs/media/home-modules.gif" width="880" alt="Switching on Home modules, making the Focus timer wider, and dragging Messages into a full-width row">
</p>

<p align="center"><sub>The demos use fictional courses and assignments.</sub></p>

## What's inside

<table>
  <tr>
    <td width="33%" valign="top">
      <h3>Home you arrange</h3>
      Add modules beside your coursework: Today, This week, a Focus timer, Clock, Notes, Bookmarks, Grades and Messages. Size them and drag them where you want.
    </td>
    <td width="33%" valign="top">
      <h3>Planner</h3>
      A week of cards. Type a task in plain words, drag work to the day you will do it, and tick it off. Canvas due dates never change.
    </td>
    <td width="33%" valign="top">
      <h3>Assignments</h3>
      The assignment list beside its instructions, with teacher updates, bookmarks and local check-offs close by.
    </td>
  </tr>
  <tr>
    <td valign="top">
      <h3>Study companion</h3>
      A small pony that walks along your modules, tells you what is next, studies beside a running timer and cheers finished work. It never scolds, and it can be switched off.
    </td>
    <td valign="top">
      <h3>Your own look</h3>
      Hand-drawn course artwork, outlines, colors, text size and layout presets, or upload your own SVG banners, icons, frames and titles. Canvas's own menu bar is drawn to match.
    </td>
    <td valign="top">
      <h3>Tools beside your work</h3>
      Desmos, GPA estimates and an AI hand-off in a side dock while you read. You choose what is shared before anything is sent.
    </td>
  </tr>
</table>

## Build your Home

**Edit Home** switches modules on and off. Each module has a three-dot menu for its width, for giving it a whole row or column, and for removing it.

To move something, hold its heading until the hand-drawn circle closes, then drag. Drop it beside or below another module, or above them all for a full-width row. **Undo move** puts things back.

## Plan the week

<p align="center">
  <img src="docs/media/planner.gif" width="880" alt="Typing a task into the Planner, which lands on Friday with a 45 minute estimate, then dragging a card to another day">
</p>

Type "essay outline fri 45m #english" and the task lands on Friday, 45 minutes, in English. Drag a card to another day or use its menu. Finished and archived work stays out of the way unless you ask for it.

## Read and do the work

See teacher updates, upcoming work and assignment instructions together. Bookmark useful materials and mark homework done locally, including work you submit outside Canvas.

**Start a Google Doc**, next to **Open in Canvas** in the Assignments reader and the Planner, opens a new Google Doc named for the course and assignment and copies the assignment's header and instructions for you to paste at the top. The doc is made in the Google account your browser is signed into; Canvas Harness does not sign in to Google.

Open Desmos, GPA estimates or AI in a side dock while you read. For AI, select your materials, review the context, and send your question to your chosen AI website.

On Instructure Canvas assignment and submission pages, click a PDF to read it beside the original page. Resize the split, search the document and keep highlights, notes and drawings in your browser. **Ask AI** opens chosen text in the AI pane for review; **Send** shares it with the provider you choose. [PDF reader details](docs/pdf-reader.md).

Canvas's course menu and **Modules** page use matching hand-drawn icons and outlines. Modules keeps Canvas's order, words, links, requirements and locked states, including course home pages that display modules.

## Make it yours

Courses get animated subject artwork automatically. **Make it yours** has five tabs of picture choices: Layout, Look, Artwork, Courses and Pony.

Describe your course to an AI using the [artwork skill](skills/canvas-harness-art/SKILL.md). Import the resulting `.chpack` through Appearance settings → Quick Upload to preview and apply the set.

## Install in Chrome or Edge

**From the Chrome Web Store (easiest):** open [Canvas Harness on the Chrome Web Store](https://chromewebstore.google.com/detail/bppjpjpbichfcbgajlppkgbbncbfohgd) and click **Add to Chrome**. A welcome page asks for your school's Canvas address, then opens it. Edge can install it from the same page after you allow extensions from other stores. Store installs update by themselves.

**From GitHub instead:**

1. Download and extract the extension ZIP from the [latest release](https://github.com/Flzsh/canvas-harness/releases/latest).
2. Open `chrome://extensions` or `edge://extensions`, enable Developer mode, and choose Load unpacked.
3. Select the folder containing `manifest.json`, then refresh Canvas.

Works on HTTPS school sites under `*.instructure.com`, and on a school's own Canvas address once you add it in the popup (your browser asks to allow that one site). [Installation help](INSTALL.md).

## Privacy

Canvas Harness reads coursework without changing submissions or grades. Coursework stays in your browser, separated by account; PDF marks stay in your browser too. By default nothing saved is shown until Canvas confirms who is signed in. Clicking Send places your chosen context on the AI provider's website; automatic context excludes grades and GPA. [Privacy details](PRIVACY.md).

<p align="center">
  <a href="docs/GETTING-STARTED.md">User guide</a> ·
  <a href="docs/THEMES.md">Themes</a> ·
  <a href="AI.md">AI guide</a> ·
  <a href="https://github.com/Flzsh/canvas-harness/issues">Report a bug</a>
</p>

<p align="center"><sub>Created by Flzsh · <a href="LICENSE">GPL-3.0-only</a> · <a href="extension/NOTICE.txt">Third-party notices</a></sub></p>
