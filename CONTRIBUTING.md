# Contributing

Thank you for helping. Bug reports, fixes and new ideas are all welcome.

## Run it

1. Clone the repository and run `npm install`.
2. Open `chrome://extensions` (or `edge://extensions`), turn on Developer mode, choose **Load unpacked** and pick the `extension` folder.
3. Open your Canvas. After a change, reload the extension and the Canvas tab.

## Check it

- `npm test` runs every test.
- `npm run check` checks the package: syntax, manifest, permissions and icons.
- `npm run preview` serves made-up courses at http://localhost:4178/. Add `?developer` to see Developer tools there.

## Report a bug

Switch on **Developer tools** (Features in the popup, then Custom), reload Canvas, reproduce the bug, then open **Tools**, choose **Developer** and press **Copy report**. Paste it into the bug form. The report has no names, coursework or school address, so it is safe to post.

Please keep real coursework, names and screenshots of real courses out of issues.

## Pull requests

- Match the style of the file you change. No new dependencies and no code loaded from the web.
- Run `npm test` and `npm run check` before you open it.
- Paste a Developer tools report from before and after your change, so the difference shows.
