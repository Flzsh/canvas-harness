# Store submission kit

The publisher must register their own developer accounts before either store can accept this extension. This folder is preparation for submission, not evidence of approval or a published store listing.

## Register

1. [Chrome Web Store registration](https://developer.chrome.com/docs/webstore/register/): use the Google account that will own the listing, accept the agreement yourself, pay the one-time fee shown at checkout, and complete the account's verification requirements. Enable two-step verification. Do not use a temporary account you will lose access to.
2. [Microsoft Edge registration](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account): enroll in the Microsoft Edge program in Partner Center using a personal Microsoft account or the supported GitHub sign-in route. Registration is free. A school/work account cannot be the primary registration account. Select the appropriate account type and complete verification and the agreement yourself.

Use a public publisher name such as **Flzsh**. Check which contact details each registration page says will become public before submitting them. This repository does not supply a private email, postal address, or legal identity for either form.

## Upload

- Run `npm test`, `npm run check`, and `npm run build` from the repository.
- Upload `dist/Canvas-Harness-2.25.0.zip`. Its `manifest.json` is at the ZIP root. Do not upload the source repository, a personal backup, or the separate Folio test build.
- Use [listing.txt](listing.txt) for the description and links. Enter the manifest's actual description where the store derives the short description from the package.
- Use `icon-128.png` for Chrome and `logo-300.png` for Edge. Both come from the original large Canvas Harness logo.
- Use `promo-440x280.png` for the small promotional image and `marquee-1400x560.png` for the marquee image.
- Ten 1280 × 800 pictures are supplied, drawn in the project's hand-drawn style with nothing covering the screens. Chrome accepts five: use numbers 1 to 5 (the title, Efficient, Versatile, Move anything, Comfortable). Numbers 6 to 10 (Your own artwork, Planner, Study companion, Home, Make it yours) are spares, or for stores that allow more.
- Review [disclosures.md](disclosures.md) against the current dashboard questions and package. Do not select “no user data” merely because there is no developer server.
- Add [reviewer-notes.md](reviewer-notes.md). Supply only a separately authorized test account if a reviewer requires one; never share your school credentials.
- Save the listing as a draft, inspect every asset and disclosure, then submit for review when the account and required testing are ready. A successful upload does not mean store approval.

## Official requirements checked

Checked October 11, 2026:

- [Chrome images](https://developer.chrome.com/docs/webstore/images): 128 × 128 icon, a 440 × 280 small promotional image, and at least one 1280 × 800 or 640 × 400 screenshot.
- [Chrome user-data policy](https://developer.chrome.com/docs/webstore/user_data): accurate privacy disclosures and a privacy policy for handling user data.
- [Edge publishing](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension): square logo (300 × 300 recommended), listing text, privacy information, testing notes and review submission. The optional small tile is 440 × 280; accepted screenshots include 1280 × 800.

Store dashboards can change. Their current form requirements take precedence over this kit.
