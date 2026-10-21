# Changelog

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
