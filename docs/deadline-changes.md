# Deadline changes

**Changes** in the dashboard toolbar shows moved, added and explicitly removed due dates observed during successful Canvas refreshes. The timestamp says when Harness noticed a change, not when or why the teacher edited it. Dates use the workspace time zone, with a zone label.

The first refresh establishes a baseline without historical alerts. New/deleted assignments, equivalent timestamps, stale snapshots, missing or invalid date fields and failed course loads do not create false changes. Explicitly null due dates can report removed deadlines. Partial loads advance only successful course baselines. A metadata storage failure reports a warning while fresh Canvas coursework still displays and caches.

Full includes this feature; Lite omits it. In Custom, enable Deadline changes, which selects its dashboard dependency. Reload Canvas after changing Features. Disabled observer scripts do not load and write no observations. Existing saved history remains available when re-enabled.

Up to 100 changes from the past 30 days are shown. Mark shown changes as read acknowledges only the displayed entries; new unseen changes from other tabs remain unread. Acknowledgement preserves history. The native dialog preserves the underlying workspace and restores focus when closed.

Data stays in `reserve:v1:<origin>:<account>:deadline-changes`: numeric course/assignment IDs, baseline dates, change titles/course names, observation times and read flags. The separate record has a 2 MB ceiling and at most 10,000 baseline assignments. Existing store locks serialize same-account tabs. This record is separate from personal backups and the Canvas cache. No grades, instructions, login tokens, new permissions or additional Canvas requests are involved.

Automated checks cover models, partial loads, retention, duplicate/stale snapshots, account/school separation, concurrent tabs, feature loading, storage failures, late session completion and dialog behavior. Installed Chrome/Edge acceptance remains necessary: use a harmless test-course due-date edit, inspect before/after values, try two tabs and check Full/Lite/Custom and account switching.
