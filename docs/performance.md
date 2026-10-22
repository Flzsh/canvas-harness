# Performance ports in 3.2.0

These changes apply to the retained public modules. Verification uses Node fixtures and operation counts; browser frame time, first paint, GPU use and installed extension behavior were not measured.

AI source catalogues reuse unchanged inputs and summaries, observe store changes, pause heartbeat work while hidden, and cancel work on disconnect or repeated destroy. The AI panel redraws changed sections separately; typing updates the composer and unchanged lists retain their nodes. Toolbox embedding uses its existing outer close control.

Appearance settings build an inert empty shell while closed and render the active pane on demand. Static diagrams are constructed when needed. Outgoing controls remain connected through the close transition, then are released; reopening, reduced motion and teardown cancel the pending cleanup. Tools avoid repeated writes to unchanged tab attributes.

Account storage reuses validation for unchanged personal data, consumes storage change values, and suppresses duplicate pending-write reloads. The extension worker serializes compare-and-write requests for each account key after current school registration is ready. Stale snapshots retry with independent edits rebased onto current data; mutators run once and conflicting paths are reported. The worker checks the trusted sender origin and matching account key for Instructure and permitted custom schools.

The pony uses cached geometry, dormant empty animation reels and one coalesced input follow check. Cosmetic metadata and same-width clock changes avoid unnecessary geometry work. Menus pause movement and animation work; closing or waking schedules the necessary refresh. No safe destination means the pony waits. Timers, observers, media listeners and detached menu handlers are released on teardown.

Regression files include `account-worker`, `account-writes`, `storage-performance`, `ai-source`, `ai-panel`, `customize-performance`, `toolbox-performance`, `pets-performance` and `pets-messages`. Run the full suite, checks, build and extracted-ZIP audit sequentially with `FOLIO_RESPONSIVE_BROWSER=0`.
