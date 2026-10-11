#!/usr/bin/env node
// Rebuilds PROMPT.md: the whole skill as one file to paste into an AI that cannot read a skill folder.
//   node scripts/build-prompt.cjs
const fs = require('fs'), path = require('path'), root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n').trim();
const skill = read('SKILL.md').replace(/^---[\s\S]*?---\s*/, '');
const demote = s => s.replace(/^(#{1,5}) /gm, '#$1 ');           // push headings one level down
const strip = s => s.replace(/<title>[\s\S]*?<\/title>\n?/, '');
const part = (title, file) => `\n\n---\n\n# ${title}\n\n${demote(read(file).replace(/^# .*\n+/, ''))}`;
const out = `<!-- Built from the canvas-harness-art skill by scripts/build-prompt.cjs. Edit the skill files, not this one. -->

# Canvas Harness course art: one-file prompt

Paste everything below into your AI assistant, then add your request at the end, for example:

> Make my Canvas Harness art for **Marine Biology**. This term we do tide-pool surveys, plankton tows, fish
> dissection and a kelp forest food web. My course colour is #2E6F73. Light theme. All three pieces.

The assistant should answer with a short note and one code block: a **quick upload pack** holding the banner, the
icon and the border. In public **CH2.21.0**, open **Customize workspace -> Quick upload**, paste the whole block
and choose **Review pack** (or choose/drop a \`.chpack\` or \`.txt\` file). Check the previews and course matches,
choose any unmatched course, leave unwanted pieces out, then apply the selected artwork. **Undo last pack** is
available during the current workspace session if the affected artwork and banner options have not changed.
For an older installed version without Quick upload, each \`<svg>...</svg>\` in the block is one piece: paste it
into that slot's "Paste SVG" box under Customize workspace -> Course artwork. Format version 1 has three slots:
banner, icon and frame; the lettered title is drawn inside the banner SVG.

Where the text below mentions files (\`references/...\`, \`templates/...\`, \`scripts/...\`), their content is included
further down in this same document; the script cannot be run from a pasted prompt, so check by hand against
section A of the checklist.

---

${skill}${part('Reference: the house style', 'references/style.md')}${part('Reference: the three pieces', 'references/slots.md')}${part('Reference: the file format', 'references/format.md')}${part('Reference: animation', 'references/animation.md')}${part('Reference: review checklist', 'references/checklist.md')}${part('Reference: handing over (the quick upload pack)', 'references/quick-upload.md')}

---

# Templates

## templates/banner-rig.svg (ground, a rigged figure, a working object)

\`\`\`svg
${strip(read('templates/banner-rig.svg'))}
\`\`\`

## templates/icon.svg

\`\`\`svg
${strip(read('templates/icon.svg'))}
\`\`\`

## templates/border.svg

\`\`\`svg
${strip(read('templates/border.svg'))}
\`\`\`

---

# Your request

`;
fs.writeFileSync(path.join(root, 'PROMPT.md'), out);
console.log('PROMPT.md', (Buffer.byteLength(out) / 1024).toFixed(1), 'KiB,', out.split('\n').length, 'lines');
