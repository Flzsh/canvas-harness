# Biscuit, locally

Biscuit uses the round-6 registry, language, intent, selection, semantics, facts, values, details, workflow, controls, sparse rules and planner modules. `pets.js` evaluates the Ask line, previews its result and up to three source choices, and executes a choice only after Enter or a click. Local actions retain feature checks, account ownership, target validation and Undo. This uses packaged rules and loaded workspace data; it does not contact an AI service.

The `pony` feature owns all 20 `biscuit-*.js` files. Lite and Custom without Pony select none of them. An enabled pet loads Basic and the generic abbreviation dictionary lazily; More and Most load only when selected with **Biscuit: more rules** enabled. That switch is opt-in and follows the public feature editor's reload behavior. A disabled pet starts no pack fetch. The existing public animation, custom drawing, quiet-time persistence, timezone handling, reminder claims and non-generative pony skills and the local Today module remain in use.

## Public controls and packs

`scripts/biscuit-control-inventory.cjs` derives the catalogue from the public editor, popup, widgets and handlers, including their current settings-tab paths. It excludes absent controls, internal saved fields and AI/Help controls. After a UI change, run `node scripts/biscuit-control-inventory.cjs --write`, then `--check`. The generated declarations and UI rows live in `extension/biscuit-controls.js`.

`scripts/biscuit-public-packs.cjs --reference-root <reference> --check` verifies the three source-pack projections and dictionary; `--write` reproduces them. Projection removes the generative action, the entire help-kind model, unsupported detail labels and two obsolete handoff cue features. Remaining coefficients and residual ancestry are preserved; no fitting or retraining occurs. Original aggregate training metadata describes the source fit. Generic subject names and abbreviations remain in `school-language.json`; it contains no school identity, school origin or teacher roster.

`scripts/biscuit-public-filter.cjs` filters declared labels and control IDs, including exact UI paths, without inspecting request wording. Both lists of the disclosed control-training fixture were pruned in local verification; training examples/worlds are not shipped. Reserved validation never enters fitting.

## AI cut points

| Site | Public behavior |
| --- | --- |
| `biscuit-engine.js`, `biscuit-inference.js` | Prompt/handoff builders and study dependencies removed. Generative requests use matching local sources or clickable “Try a line” suggestions. Exported results and compound steps are local. |
| `biscuit-parse.js`, `pony-ask.js` | No generative candidate or study-help action; unknown legacy requests keep the public local fallback. |
| `biscuit-registry.js`, `biscuit-context-selector.js`, `biscuit-learn.js` | No study-aid provider, AI settings rows, prompt context extraction or study-kind dependency. Local grade/feedback visibility gates remain. |
| `pets.js`, `widgets.js` | No engine-AI button, AI callback, AI snapshot flag, `helpWith`, Help band or `onAsk` integration. “help” opens the public command suggestions. |
| `pony-brain.js`, features and customization | Public non-generative skills retained; only local knowledge tiers added. No private-build agent, study, overnight or custom-pet hydration modules imported. |

The public build's pre-existing, separate provider/PDF handoff features are outside Biscuit and unchanged by this port. There are no new `ai-*`, `agent-*` or `study-*` files. AI help panels, source-card merges, study products and ready-aid offers are omitted; their pet entry points use local results/suggestions instead. Existing public installed-pack and custom-drawing behavior is retained where richer reference integrations need absent modules.

## Verification

Mixed AI expectations in the public flow, focus, language, menu, parse and pony-ask tests now assert local fallback. Applicable reference runtime/rules/tier, planner, source, controls, storage and pet tests are retained; the new public tests cover provider isolation, nested results and cancelled/lazy tier loads. The [test-port audit](../tests/biscuit-public.test.cjs) lists all 53 excluded reference files and removed individual cases: 23 AI/Help/study/context suites, 3 private integration harnesses replaced by public checks, 1 staged optimization comparison and 26 fitting/evaluator/provenance/development suites. No sealed fixtures are copied or scored.

Run `npm test`, `npm run check` and `npm run build`. On Windows, the test launcher uses relative paths to stay below the process command-line limit and reports launch errors explicitly.

Run `node scripts/biscuit-r6-eval.cjs --reference-root <reference> --tier basic --include-unavailable` for every reserved non-AI label. Omit `--include-unavailable` for the separate public-compatible denominator, which excludes absent controls and changed exact UI paths. It applies the reference short-line policy and R6 compound/ambiguity scoring, excludes AI/help labels (and, by default, missing/changed public controls), verifies the actual loaded tier, and reports counts plus per-evaluation latency. Its entry point cannot discover or score sealed set-6. The validation fixture and development reports are not copied into the public repository.

The artificial preview supports `calc hw` (two choices), `tmrw` (clarification), `focus 25`, `dark mode`, `open planner` and `help`. Browser checks use this preview, not a signed-in Canvas account.

Measured on Windows with Node 24.14.1: the pristine baseline passed 3,089 tests with 3 skipped; the port passed 4,625 with 3 skipped. Check and build passed. All non-AI validation labels retained 1,996 of 2,208 rows; Basic short top-1 was 1,484/1,544 (96.11%), p95 26.50 ms. The separate public-compatible subset retained 1,641 rows: short top-1 1,324/1,372 (96.50%), p95 23.33 ms. These denominators differ from the reference headline. Latency measures engine evaluation, excluding lazy pack loading; no evaluation errors occurred.

The catalogue has 580 controls and 474 runtime UI rows. Filtering the disclosed control-training fixture retained 933/1,773 rows and 933/1,773 situations in local verification, without fitting or shipping them. The zip grew from 24,247,497 to 25,556,118 bytes. Lite still selects 38 scripts and Custom (dashboard/planner/customization, pet off) 44: shared UI JavaScript grows by 64,743 and 65,281 bytes respectively, with zero Biscuit scripts or rule packs selected.
