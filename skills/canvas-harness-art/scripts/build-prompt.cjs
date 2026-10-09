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

The assistant should answer with three SVG files (banner, icon, border) and a short note. Save each as a \`.svg\`
file and upload it in Canvas Harness: Customize workspace -> Course artwork.

Where the text below mentions files (\`references/...\`, \`templates/...\`, \`scripts/...\`), their content is included
further down in this same document; the script cannot be run from a pasted prompt, so check by hand against
section A of the checklist.

---

${skill}${part('Reference: the house style', 'references/style.md')}${part('Reference: the three pieces', 'references/slots.md')}${part('Reference: the file format', 'references/format.md')}${part('Reference: animation', 'references/animation.md')}${part('Reference: review checklist', 'references/checklist.md')}

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
