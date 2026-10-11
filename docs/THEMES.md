# Themes and artwork

Open **Appearance settings** in the Canvas Harness toolbar. The settings dock stays beside the workspace, so you can compare a change with your actual layout as you make it.

Appearance is saved locally for the current Canvas site and account. Renaming or hiding a course changes your workspace, not the teacher's Canvas course.

## Choose a starting layout

| Preset | Starting point |
| --- | --- |
| Studio | Course information first, with paper surfaces and sketched borders. |
| Study | Assignments first, with a clean surface, rounded borders, and a compact banner. |
| Focus | A stacked workspace with a horizontal course strip, compact banners, and fewer course-information and deadline-preview elements. |

Then adjust the sidebar or horizontal course strip, panel order, surface style, border style, banner size, spacing, and reading typography. The surface contrast setting offers another way to make the page easier to read.

Use **Show grades** separately when you want grades visible. Leaving it off hides grades in the interface; cached Canvas data can still contain them.

## Keep the drawings lively, or let them rest

The 22 automatic subject presets match familiar course names and codes. When a course has no matching subject preset, it uses a general illustration and a single sketched frame. If its displayed name has no matching title drawing, a generic illustrated label preserves that name.

All courses keeps its time-of-day greeting beside the overview artwork. Generic illustrated labels are used for individual course names. An explicitly uploaded overview title takes priority; uploading only an overview banner keeps the greeting.

Choose **Living drawings → Off** to stop the bundled drawings' ongoing ambient movement. Motion settings also control transitions and reveals; the animation-off and reduced-motion paths use static artwork. Imported drawings retain their own palette. Choose artwork with readable contrast against the paper surface.

## Make an artwork pack with an AI assistant

Use the [complete prompt](../skills/canvas-harness-art/PROMPT.md), or install the [artwork skill](../skills/canvas-harness-art/SKILL.md) using its [installation guidance](../skills/canvas-harness-art/README.md#using-it). The skill is available in the repository separately from the extension install ZIP.

For example:

> Make Canvas Harness artwork for Astronomy. This term covers telescope observations, lunar phases, and orbital motion. Use a sage accent. Deliver one .chpack with a coordinated animated banner, icon, and border, and draw the course name into the banner.

Give the assistant the displayed course name you want Quick Upload to match. Describe the actual topics and activities so the drawing fits the class. You can request a pack with one replacement piece later.

The [astronomy example](../skills/canvas-harness-art/examples/astronomy/astronomy.chpack) is a ready-made pack to try. Save the linked file, then choose it in Quick Upload and map its course destination in the preview.

## Preview, match, and apply

1. Open **Appearance settings → Quick Upload**.
2. Choose or drop a **.chpack** or **.txt** file. Alternatively, expand **Or paste a pack**, paste the complete output, and choose **Review pack**.
3. Inspect the drawings and any validation notices. Check each **Apply to** destination. Choose a course for an unmatched group, or uncheck it.
4. Uncheck individual pieces you want to leave unchanged.
5. Choose **Apply N pieces** and wait for **Artwork applied**.

Quick Upload changes the selected banners, icons, and borders together, plus any explicit banner fit and position options in the pack. Reviewing alone does not save it. Other preferences stay as they were.

**Undo last pack** restores the affected artwork during the current workspace session if those artwork fields and banner options have not changed since applying. It does not undo unrelated preferences. Export a personal backup before a large change if you want recovery that survives closing the page.

## Upload individual SVGs and custom titles

Under **Course artwork**, choose a course or **All courses**, then upload or paste an SVG into its banner, icon, border, or title slot. Starter templates and the built-in artwork can help you begin again.

Quick Upload pack version 1 supports banners, icons, and borders. When the banner includes its drawn name, choose **Course title → Already drawn in banner** under Course artwork. This gives the uploaded scene the full banner without a second title layer. Choose **Separate title drawing** to restore the original title, or upload your own title SVG.

Self-contained SVG CSS and SMIL animation are supported. Artwork is checked and rendered as isolated images. Scripts, external images or fonts, embedded HTML, and unsupported editor-specific features are rejected.

Each SVG is limited to **256 KiB**, and all imported artwork together to **2 MiB**. A pack can replace only the pieces you selected. If the budget is full, remove an unused upload or simplify an SVG, then review again. Validation notices explain what needs changing.

## Keep a backup

Use **Appearance settings → All settings & backups → Export my backup** before an update or a substantial artwork change. Backups include account-specific personal appearance and imported art, so keep them private.

**Reset appearance** keeps personal notes, plans, and bookmarks. Use **Import backup** for the matching Canvas account to restore a saved workspace; this replaces the personal workspace with the backup. See [Get started](GETTING-STARTED.md#back-up-your-personal-workspace) before restoring.

[Get started](GETTING-STARTED.md) · [README](../README.md) · [Artwork examples](../skills/canvas-harness-art/examples/)
