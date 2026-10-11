# Quick upload packs: format and behaviour (version 1)

This is the contract between whoever **makes** a pack (an AI assistant following the `canvas-harness-art` skill, or
`scripts/pack.cjs`) and whoever **reads** one (Quick upload in the Canvas Harness extension). It is written for the
person implementing the extension side.

- Reference reader and writer: [`scripts/quick-pack.js`](../scripts/quick-pack.js) (no dependencies; loads as a
  CommonJS module or as a plain script that defines `globalThis.CanvasHarnessPack`). It can be copied into the
  extension as it is.
- Test packs with the results every reader must produce: [`vectors/`](vectors).
  Run `node scripts/test-pack.cjs` for the reference reader, or `node scripts/test-pack.cjs path/to/your-reader.js`
  for another one.

The words MUST, SHOULD and MAY are used in their usual specification sense.

## 1. What a pack is for

Public Canvas Harness CH2.21.0 implements Quick upload under Customize workspace: paste or choose/drop a pack,
review the artwork and targets, then apply the selected pieces. Manual per-slot upload remains a fallback for
older installed versions.
A **pack** is one piece of text that carries any number of SVGs together with directions saying where each one goes.
The user gives the pack to Quick upload once and reviews one list.

- **Easy:** one paste or one dropped file.
- **Any size:** a pack can change one banner, or the banner, icon and frame of every course and of the All courses page.
- **Open-ended:** a pack is a list of typed parts. Version 1 defines one type, artwork (`ch-art`). Later versions
  can add others (settings, themes) without breaking readers or packs that exist today.

A pack only ever adds or replaces what it names. Everything else the user has stays as it is.

## 2. Two ways in, one format

| Way | What the user does |
|---|---|
| **Paste** (the default the skill asks assistants to use) | Copies the pack text from the assistant's answer and pastes it into the Quick upload box. |
| **File** | Saves or receives the same text as a file named `something.chpack` and drops it on Quick upload (or picks it with a file chooser). |

The file is the pasted text, byte for byte: UTF-8 plain text, with or without a byte order mark, with either kind of
line ending. A reader MUST treat both ways identically, and MUST NOT rely on the file name or extension: a pack is
recognised by its content (section 3). Quick upload SHOULD accept `.chpack` and `.txt` in its file chooser.

## 3. Syntax

A pack is a sequence of **directives**. A directive looks like an XML processing instruction whose name starts with
`ch-`:

```
<?ch-KIND name="value" name="value" ...?>
```

- `KIND` is letters, digits and hyphens, starting with a letter; it is not case-sensitive.
- After the kind come zero or more attributes, separated by white space (line breaks included).
- An attribute is `name="value"`. Names are letters, digits and hyphens and are not case-sensitive. A reader MUST
  also accept `'single quotes'`, `“curly double quotes”` (chat applications produce them) and a bare value with no
  quotes and no white space. If a name appears twice, the first wins.
  Malformed attribute tokens are ignored whole, including their quoted text: a reader MUST NOT recover a known
  attribute from a suffix of an invalid name or from text inside a malformed token. Adjacent attributes without
  separating white space are malformed.
- In a value, `&quot;` `&apos;` `&amp;` `&lt;` `&gt;` stand for `"` `'` `&` `<` `>`. Values are trimmed. A writer MUST
  escape `&`, `"`, `<` and `>` in values.
- A directive is at most 2,048 characters between `<?ch-KIND` and `?>`. A longer one (usually a directive whose
  closing `?>` was lost) is skipped, with the reason `bad-directive`.
  This bound applies to the opening pack line and end line too. An oversized opening pack line refuses the pack
  (`bad-directive`). An oversized subsequent `ch-pack` or `ch-end` is ignored with a `bad-directive` pack warning:
  it cannot end the pack or supply a part count, and these control lines do not count as parts. Writers MUST
  enforce the bound after escaping attribute values.
- Attributes a reader does not know are ignored.

Everything between one directive and the next is the **body** of the first. The text before the first
`<?ch-pack ...?>` and after `<?ch-end ...?>` is not part of the pack and MUST be ignored: that is where a chat
application's sentences and code fences end up.

Canvas Harness's artwork validator refuses every processing instruction inside an SVG, so the characters `<?ch-` can
never be part of a valid piece of artwork. That is what makes this framing safe without any escaping of the SVG.

### 3.1 The pack line

```
<?ch-pack version="1" name="Marine Biology"?>
```

| Attribute | | Meaning |
|---|---|---|
| `version` | required | A positive whole decimal number written entirely as digits. This document is version `1`. |
| `name` | optional | A short name to show the user (at most 120 characters are kept). |

Text is a pack if and only if it contains a `ch-pack` directive. If the version is missing or not a number, the pack
is refused (`bad-version`). The entire trimmed value must be a positive whole decimal number: `1junk`, `1.0`,
`1e0` and `+1` are invalid; leading zeros are allowed. If the version is greater than the reader's, the pack is refused (`newer-version`) with
a message telling the user to update Canvas Harness. Any `ch-` directive found before the pack line is ignored with
a warning (`before-header`).

### 3.2 The end line

```
<?ch-end parts="3"?>
```

Ends the pack. `parts` is the number of parts the writer put in the pack, of every kind, not counting the pack line
and the end line. A writer MUST write the end line and SHOULD write the count.
The optional count is a nonnegative whole decimal number written entirely as digits; an invalid count is ignored.

- No end line: the pack is still read, with the warning `no-end` ("may have been cut off").
- A count that differs from the number of parts found: warning `count-mismatch`.

Both warnings mean the text was probably truncated on its way (a chat answer that ran out of room, an incomplete
copy). Quick upload MUST show them before the user applies anything.

A second `ch-pack` line inside a pack ends it (warning `second-header`); one paste is one pack.

### 3.3 An artwork part

```
<?ch-art course="Marine Biology" slot="banner"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1680 240">...</svg>
```

| Attribute | | Meaning |
|---|---|---|
| `slot` | required | `banner`, `icon` or `frame`. `border` MUST be accepted as another word for `frame`. |
| `course` | one target is required (3.4) | The name of the course, or several names it might go by separated by `\|`. |
| `course-id` | | The course's Canvas id (the number in `/courses/12345`). May accompany `course`. |
| `place` | | `overview` (the All courses page) or `every-course`. Instead of `course` and `course-id`. |
| `fit` | optional, banner only | `contain` or `cover`. |
| `position` | optional, banner only | `left`, `center` or `right`. |
| `name` | optional | The label stored with the artwork (shown where the extension shows an upload's file name). Default: the first course name or the place, then the slot, for example `Marine Biology banner`. |

How the slots map onto public Canvas Harness CH2.21.0 (`customization-model.js`):

| `slot` | Stored as | Rendered with kind |
|---|---|---|
| `banner` | `bannerArt` | `banner` |
| `icon` | `iconArt` | `icon` |
| `frame` | `borderArt` | `border` |

`fit` and `position` set `bannerFit` and `bannerPosition` of the same course (or of the overview). When a banner
part gives neither, the reader leaves the user's current values alone. On a part that is not a banner, and when the
value is not one of those listed, the attribute is ignored with the warning `option-ignored`; the part is still good.

The lettered course title is part of the banner picture in Canvas Harness; there is no separate title slot in
version 1. `slot="title"` is therefore an unknown slot today (`bad-slot`). See section 8 for how one can be added.

**The body.** The SVG of a part is the text from the first `<svg` (followed by white space or `>`) to the last
`</svg>` in the part's body, both included. Anything else in the body is dropped: an XML declaration, a code fence,
a sentence. If there is no such span, the part has the error `no-svg`.

The SVG is then given, unchanged, to the extension's artwork validator, exactly as an uploaded file would be
(section 5). A pack never loosens what artwork is accepted.

### 3.4 Targets

A part names exactly one target.

| Written as | Target | Applied to |
|---|---|---|
| `course="Marine Biology"` | one course, found by name | that course's appearance (`coursePrefs[id]`) |
| `course="AP Biology\|AP Bio"` | one course, any of these names | the same |
| `course-id="48213"` (with or without `course`) | one course, by Canvas id; the names are the fallback | the same |
| `place="overview"` | the All courses page | `overviewArt` |
| `place="every-course"` | each course the user currently has | every `coursePrefs[id]` |

- Neither `course`, `course-id` nor `place`: error `no-target`.
- `place` together with `course` or `course-id`: error `two-targets`.
- A `place` the reader does not know: error `bad-place`.

**Finding the course.** Packs are usually made by someone who knows the course's name but not its Canvas id, and a
pack may be shared between people whose courses are named differently. So names are matched, and the user confirms.
`matchCourse(target, courses)` in the reference file is the rule; in words:

1. *Normalise* a name: Unicode NFKC, lower case, every run of characters that are not letters or digits becomes one
   space, trim. (This is the `normalize` of `subject-art.js` without its "U.S." special case. Accents are kept.)
2. If the target has an id and exactly one of the user's courses has that id: that course. Otherwise go on by name.
3. Each course has up to three labels: its original Canvas name, the user's display name, and its course code,
   all normalised.
4. **Exact:** the courses that have a label equal to one of the target's names. If there is at least one, stop
   here: one course is a match, several are ambiguous.
5. **Whole words:** the courses that have a label containing every word of one of the target's names, as whole
   words, in any order. One course is a match, several are ambiguous, none is no match.

A reader MUST NOT apply a part to a course unless that course is a match **and the user has seen it** in the review
(section 5), or the user has chosen the course themselves. When the result is ambiguous or there is no match, the
review asks the user to choose from their courses, or to skip. Parts that name the same target (the same id, or the
same first name after normalising) share one choice.

## 4. Order and repeats

If two parts are for the same slot of the same target, the later one is used and the earlier one is marked
`replaced` (it is not an error in the pack, and the pack is still good).

`place="every-course"` and a named course can both give the same slot. The named course always wins, wherever the
two parts sit in the pack: a reader applies every-course parts first and all other parts after them, each group in
pack order. `applyOrder(parsed)` in the reference file returns the applicable parts in that order.

## 5. What Quick upload does with a pack

1. **Read** the text with `parse` (or an equivalent that passes the test packs). If the result is not `ok`, show its
   error and stop. Nothing has been changed.
2. **Validate** each part's SVG with the extension's own validator (`ReserveCustomArt.importSVG(svg, name)` in 2.20).
   A part whose SVG is refused gets that refusal as its error; the other parts are unaffected.
3. **Resolve** every target (3.4) against the user's current courses.
4. **Review.** Show one list, grouped by target, before anything is stored:
   - the pack's name, and any pack warnings (`no-end`, `count-mismatch`, `skipped`...);
   - for each target: the course it matched, with a way to change it (and a required choice when it is ambiguous or
     unmatched), and a way to leave that target out;
   - for each part: its slot, a preview, whether it replaces artwork the user already has there, and its error if it
     has one. A part with an error cannot be applied.
5. **Apply** when the user confirms: write every accepted part to its target, with `fit` and `position` where
   given. Check the total artwork budget (`ReserveCustomization.checkBudget`, 2 MiB) on the result. The write MUST be
   all or nothing: if the budget is exceeded or storage fails, nothing changes and the user is told why.
6. **Report** what was applied and what was not.

Nothing is stored before the user confirms. This matters: pack text can come from anywhere.

Quick upload SHOULD offer one "undo" for the last pack applied (restoring the art it replaced), because a pack can
overwrite many slots at once.

## 6. Results and codes

`parse` returns:

```
{ ok, version, name, attrs,
  parts:   [{ index, kind: 'art', slot, target, name, svg, fit?, position?, attrs, errors: [], warnings: [], replacedBy? }],
  skipped: [{ index, kind, reason }],
  warnings: [{ code, message }], errors: [{ code, message }] }
```

`index` counts every part of the pack from 1, skipped ones included. `target` is `{ type: 'course', names: [...],
id? }`, `{ type: 'overview' }` or `{ type: 'every-course' }`. The codes are part of the format; the wording of the
messages is not, and a reader may write its own.

| Where | Code | Meaning |
|---|---|---|
| pack error (`ok` is false, nothing is applied) | `not-text` | The input is not text. |
| | `too-large` | More than 3 MiB. |
| | `not-a-pack` | No `ch-pack` line. |
| | `bad-directive` | The opening pack line exceeds the directive limit. |
| | `bad-version` | The version is missing or not a number. |
| | `newer-version` | The version is greater than the reader's. |
| | `too-many-parts` | More than 128 parts. |
| | `empty` | No parts. |
| part error (that part is not applied) | `no-slot`, `bad-slot` | The slot is missing or unknown. |
| | `no-target`, `two-targets`, `bad-place` | See 3.4. |
| | `no-svg` | No complete `<svg>...</svg>` in the body. |
| | `replaced` | A later part is for the same slot of the same target. |
| | (the validator's message) | The SVG was refused in step 2 of section 5. |
| part warning | `option-ignored` | `fit` or `position` was ignored. |
| | `directive-text` | Part of the directive could not be read as attributes. |
| pack warning | `no-end`, `count-mismatch` | Probably cut off. |
| | `bad-directive` | An oversized subsequent pack or end line was ignored. |
| | `skipped` | Parts of a kind the reader does not know were skipped. |
| | `before-header`, `second-header` | See 3.1 and 3.2. |

## 7. Limits

| | |
|---|---|
| Pack text | at most 3 MiB (3,145,728 bytes of UTF-8) |
| Parts | at most 128 |
| A directive | at most 2,048 characters |
| Each SVG | whatever the artwork validator allows (256 KiB in 2.20) |
| All of a user's artwork after applying | whatever the extension allows (2 MiB in 2.20) |

The paste box MUST accept at least 3 MiB of text. The per-slot "Paste SVG" boxes in 2.20 stop at 262,144
characters; that limit is too small for a pack.

## 8. Growing the format

- A reader MUST skip a part whose kind it does not know (it goes in `skipped`, with the warning `skipped`) and MUST
  ignore attributes it does not know. This is what lets a newer pack still work, in part, in an older extension.
- A change that an older reader would get wrong, not merely miss, needs a new `version`.
- New kinds take the form `<?ch-KIND ...?>` followed by a body in whatever notation suits them (JSON for settings,
  for example). Kinds `settings`, `theme`, `note` and `remove` are reserved for future use and MUST be skipped by a
  version 1 reader.
- New slots (a separate `title`, say) and new places are added as new values; a version 1 reader reports them as
  `bad-slot` or `bad-place` and applies the rest of the pack.

## 9. Safety requirements

1. Pack text is data. It is never evaluated, never inserted into a page as HTML, and nothing in it is fetched.
2. Every SVG goes through the same validator as a manual upload, and is stored and shown the same way (an isolated
   image). A pack is not a way round any artwork rule.
3. Names from a pack (`name` on the pack line and on parts, course names) are untrusted text: escape them wherever
   they are shown.
4. Nothing is stored until the user has seen the review and confirmed.
5. A pack cannot reach anything but the artwork slots and the two banner options of the targets it names. Version 1
   has no part that removes artwork or changes any other setting.
6. Enforce the limits in section 7 before doing any other work on the text.

## 10. A complete example

What an assistant sends, in one code block, for one course:

```
<?ch-pack version="1" name="Marine Biology"?>

<?ch-art course="Marine Biology" slot="banner"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1680 240">...</svg>

<?ch-art course="Marine Biology" slot="icon"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">...</svg>

<?ch-art course="Marine Biology" slot="frame"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 110">...</svg>

<?ch-end parts="3"?>
```

A change to one thing is the same with one part. A whole term is the same with more parts:

```
<?ch-pack version="1" name="Autumn term"?>
<?ch-art place="every-course" slot="frame"?>
<svg ...>...</svg>
<?ch-art course="AP Biology|AP Bio" slot="banner"?>
<svg ...>...</svg>
<?ch-art course="Music Theory" slot="banner" fit="cover" position="center"?>
<svg ...>...</svg>
<?ch-art place="overview" slot="banner"?>
<svg ...>...</svg>
<?ch-end parts="4"?>
```

A real pack made by this skill is [`examples/astronomy/astronomy.chpack`](../examples/astronomy/astronomy.chpack).

## 11. The test packs

| File | What it pins down |
|---|---|
| `01-one-piece.chpack` | The smallest useful pack. |
| `02-full-set.chpack` | Three slots, banner options, a part name, text before the pack line. |
| `03-several-targets.chpack` | Every kind of target, several names, an id, escaped characters in a name. |
| `04-pasted-from-chat.txt` | Sentences and code fences round and inside the pack, curly and single quotes, a bare value, an XML declaration, `border` for `frame`, a directive on two lines, text after the end line. |
| `05-cut-off.chpack` | A pack that stops in the middle of an SVG. |
| `06-newer-things.chpack` | Unknown kinds, an unknown attribute, an unknown slot. |
| `07-mistakes.chpack` | Every part error, an ignored option, a repeated slot, a wrong count. |
| `08-not-a-pack.txt` | A bare SVG. |
| `09-newer-version.chpack` | A version the reader does not have. |
| `matching.json` | Courses and targets with the match each must give. |

Each has a `.expected.json` beside it: the result reduced to what readers must agree on (codes, not messages; the
byte length of each SVG, not its text).
