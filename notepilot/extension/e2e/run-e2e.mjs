/**
 * End-to-end test: loads the built extension (dist-e2e) into real Chromium, routes the Google Docs
 * REST API to a mutable fake document and the AI endpoint to a scripted model, then drives the real
 * side panel UI through the acceptance scenario and captures screenshots.
 *
 * Usage: npm run e2e   (builds dist-e2e with VITE_E2E_FAKE_AUTH=1 first)
 * Env:   CHROMIUM_PATH (defaults to the Playwright-managed Chromium), E2E_SHOTS (screenshot dir)
 */
import { chromium } from 'playwright-core';
import { mkdtempSync, mkdirSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import * as model from './fakeModel.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const extDir = resolve(here, '../dist-e2e');
const shots = resolve(process.env.E2E_SHOTS ?? join(here, 'screenshots'));
mkdirSync(shots, { recursive: true });

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  const dir = existsSync(root) ? readdirSync(root).find((d) => /^chromium-\d+$/.test(d)) : null;
  if (!dir) throw new Error('Set CHROMIUM_PATH to a Chromium/Chrome binary');
  return join(root, dir, 'chrome-linux', 'chrome');
}

const DOC_ID = 'E2E_DOC_0123456789abcdefghijkl';
const NOTES = ['mitochondria makes ATP.', 'glycolysis cytoplasm.', 'krebs produces nadh.', 'ETC requires oxygen.', "glycolysis doesn't need oxygen.", 'ATP synthase uses proton gradient to'];

// ── Fake Google Doc (served through the real Docs API URL shape) ──
const doc = { paras: [...NOTES], revision: 1 };
const docsRequests = [];
const edit = (fn) => {
  doc.paras = fn([...doc.paras]);
  doc.revision++;
};
const docsJson = () => ({
  documentId: DOC_ID,
  title: 'Bio 101 — lecture notes',
  revisionId: `rev-${doc.revision}`,
  tabs: [
    {
      tabProperties: { tabId: 't.0', title: 'Tab 1' },
      documentTab: { body: { content: [{ sectionBreak: {} }, ...doc.paras.map((t) => ({ paragraph: { elements: [{ textRun: { content: t + '\n' } }], paragraphStyle: { namedStyleType: 'NORMAL_TEXT' } } }))] } },
    },
  ],
});

const aiLog = [];
const driveRequests = [];
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };

const log = (...a) => console.log('[e2e]', ...a);
const results = [];
const check = async (name, fn) => {
  try {
    await fn();
    results.push({ name, ok: true });
    log('✓', name);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    log('✗', name, '\n   ', e.message);
  }
};

const userDataDir = mkdtempSync(join(tmpdir(), 'notepilot-e2e-'));
const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath: findChromium(),
  headless: process.env.HEADED ? false : true,
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`, '--no-first-run', '--no-default-browser-check'],
  viewport: { width: 420, height: 860 },
  deviceScaleFactor: 2,
});

try {
  // Network fakes.
  await context.route('https://docs.googleapis.com/**', async (route) => {
    const req = route.request();
    docsRequests.push({ method: req.method(), url: req.url() });
    const url = new URL(req.url());
    const body = url.searchParams.get('fields') === 'revisionId' ? { revisionId: `rev-${doc.revision}` } : docsJson();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  // Google Drive upload endpoint (companion Google Doc).
  await context.route('https://www.googleapis.com/upload/drive/**', async (route) => {
    const req = route.request();
    const corsDrive = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, PATCH' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: corsDrive });
    driveRequests.push({ method: req.method(), url: req.url(), body: req.postData() ?? '', auth: req.headers().authorization });
    const id = 'e2e-companion-doc';
    await route.fulfill({ status: 200, headers: corsDrive, contentType: 'application/json', body: JSON.stringify({ id, webViewLink: `https://docs.google.com/document/d/${id}/edit`, trashed: false }) });
  });
  await context.route('https://ai.notepilot.test/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = JSON.parse(req.postData() ?? '{}');
    const user = body.messages.find((m) => m.role === 'user').content;
    const payload = JSON.parse(user.slice(user.indexOf('{')));
    const isInsights = body.messages[0].content.includes('tutor and research assistant');
    const isSummary = body.messages[0].content.includes("NotePilot's study assistant");
    const kind = isSummary ? 'summary' : isInsights ? 'insights' : 'rewrite';
    const out = isSummary ? model.summary(payload) : isInsights ? model.insights(payload) : model.rewrite(payload);
    aiLog.push({ kind, model: body.model, payload, system: body.messages[0].content, at: Date.now() });
    await new Promise((r) => setTimeout(r, 400)); // simulated model latency
    await route.fulfill({
      status: 200,
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify({ model: body.model, choices: [{ message: { content: JSON.stringify(out) }, finish_reason: 'stop' }], usage: { prompt_tokens: Math.ceil(user.length / 4), completion_tokens: 300 } }),
    });
  });

  // Extension id from its service worker.
  let [sw] = context.serviceWorkers();
  sw ??= await context.waitForEvent('serviceworker', { timeout: 15_000 });
  const extId = new URL(sw.url()).host;
  log('extension loaded:', extId);

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  // Seed settings as if the user had completed setup (provider + consent), then load the panel.
  await page.goto(`chrome-extension://${extId}/sidepanel.html`);
  await page.evaluate(async () => {
    await chrome.storage.local.set({
      settings: {
        frequency: 'realtime',
        insightDepth: 'standard',
        ai: { mode: 'direct', baseUrl: 'https://ai.notepilot.test/v1', apiKey: 'sk-e2e', fastModel: 'fast-model', deepModel: 'deep-model', jsonMode: 'json_object', inputPricePerM: 0.4, outputPricePerM: 1.6, proxyUrl: '', proxyToken: '' },
        consent: { endpointOrigin: 'https://ai.notepilot.test', at: Date.now() },
      },
    });
  });
  await page.goto(`chrome-extension://${extId}/sidepanel.html?doc=${DOC_ID}`);

  const headings = () => page.$$eval('article h2, article h3, article h4', (els) => els.map((e) => e.textContent.replace(/^\s*[\d.]+\s*/, '').trim()));
  const unitText = (fragment) => page.locator('[data-origin]', { hasText: fragment });

  await check('organizes unstructured notes automatically', async () => {
    await page.getByRole('heading', { name: /Glycolysis/ }).waitFor({ timeout: 30_000 });
    assert.deepEqual(await headings(), ['Cellular Respiration', 'Overview', 'Glycolysis', 'Citric Acid Cycle', 'Electron Transport Chain']);
    await page.locator('.katex').first().waitFor({ timeout: 5000 });
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(shots, '01-organized-notes.png') });

  await check('labels AI clarifications and expansions distinctly', async () => {
    assert.equal(await page.locator('[data-origin="clarification"]').count(), 1);
    assert.equal(await page.locator('[data-origin="expansion"]').count(), 1);
    assert.match(await page.locator('[data-origin="expansion"]').innerText(), /AI expansion · unverified/i);
  });

  await check('a cut-off sentence is finished, with the AI-added words highlighted', async () => {
    const fill = page.locator('.np-filled');
    assert.equal(await fill.count(), 1);
    assert.equal(await fill.innerText(), 'produce ATP');
    assert.equal(await fill.getAttribute('title'), 'Completed by AI. Not in your notes.');
    const body = await page.locator('main').innerText();
    assert.ok(!body.includes('⟦') && !body.includes('⟧'), 'markers are never shown');
    assert.ok(!/truncated/i.test(body), 'no "truncated" ambiguity notes');
    const sys = aiLog.find((e) => e.kind === 'rewrite').system;
    assert.match(sys, /UNFINISHED NOTES/);
    assert.match(sys, /Also develop ideas the student started/);
  });

  // Mark the Glycolysis passage's DOM node to prove later updates patch rather than re-render.
  await unitText('breaks glucose down').evaluate((el) => (el.dataset.e2eMarker = 'kept'));
  const scroller = page.locator('main');

  await check('new fact is placed at its conceptual location, not appended', async () => {
    edit((p) => [...p, 'fermentation regenerates NAD+ when no oxygen.']);
    const t0 = Date.now();
    await page.getByRole('heading', { name: /Anaerobic Metabolism/ }).waitFor({ timeout: 30_000 });
    log(`   fermentation visible after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    assert.deepEqual(await headings(), ['Cellular Respiration', 'Overview', 'Glycolysis', 'Anaerobic Metabolism', 'Citric Acid Cycle', 'Electron Transport Chain']);
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, '02-new-section-inserted.png') });

  await check('a fact about an earlier topic updates that section in place (same DOM node, scroll kept)', async () => {
    await scroller.evaluate((el) => (el.scrollTop = 120));
    const before = await scroller.evaluate((el) => el.scrollTop);
    const t0 = Date.now();
    edit((p) => [...p, 'glycolysis net 2 ATP']);
    await unitText('net gain of').waitFor({ timeout: 30_000 });
    log(`   update visible after ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    const marker = await unitText('net gain of').evaluate((el) => el.dataset.e2eMarker);
    assert.equal(marker, 'kept', 'unit DOM node was replaced instead of patched');
    assert.equal(await page.locator('[data-origin]', { hasText: 'Glycolysis' }).count() >= 1, true);
    const after = await scroller.evaluate((el) => el.scrollTop);
    assert.ok(Math.abs(after - before) < 2, `scroll moved from ${before} to ${after}`);
  });

  await check('collapsed sections stay collapsed across updates', async () => {
    await scroller.evaluate((el) => (el.scrollTop = 0));
    await page.getByRole('button', { name: /Overview/ }).click();
    assert.equal(await unitText('extract energy from nutrients').count(), 0);
    edit((p) => p.map((x) => (x === 'krebs produces nadh.' ? 'krebs produces nadh and fadh2 in the matrix.' : x)));
    await unitText('FADH₂').waitFor({ timeout: 30_000 });
    assert.equal(await unitText('extract energy from nutrients').count(), 0, 'collapsed section was re-expanded by an update');
    await page.getByRole('button', { name: /Overview/ }).click();
  });

  await check('editing an earlier statement reconciles the organized version', async () => {
    assert.match(await unitText('FADH₂').innerText(), /matrix/);
    assert.equal(await unitText('produces the reduced electron carrier').count(), 0);
  });

  await check('deleting a statement removes what it supported (incl. anchored AI expansion)', async () => {
    edit((p) => p.filter((x) => x !== 'ETC requires oxygen.'));
    await page.waitForFunction(() => !document.body.innerText.includes('requires oxygen'), null, { timeout: 30_000 });
    assert.equal(await page.locator('[data-origin="expansion"]').count(), 0);
    assert.equal(await unitText('ATP synthase').count(), 1);
  });

  await check('insights update automatically and link back to sections', async () => {
    await page.getByRole('tab', { name: /Insights/ }).click();
    await page.getByText('Check your understanding').waitFor({ timeout: 60_000 });
    assert.ok((await page.locator('article').count()) >= 3);
    await page.getByRole('button', { name: 'Show answer' }).click();
    await page.getByText(/runs out and glycolysis stops/).waitFor();
  });
  await page.screenshot({ path: join(shots, '03-insights.png') });

  await check('insight section chips navigate to the organized notes', async () => {
    await page.locator('article footer button', { hasText: 'Anaerobic Metabolism' }).first().click();
    await page.getByRole('heading', { name: /Anaerobic Metabolism/ }).waitFor();
  });

  await check('later updates do not re-trigger an earlier navigation; unorganizable notes still appear verbatim', async () => {
    await scroller.evaluate((el) => (el.scrollTop = 0));
    edit((p) => [...p, 'cytochrome c shuttles electrons']); // scripted model returns no ops for this
    await page.getByRole('heading', { name: /Not Yet Organized/ }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(600);
    assert.ok((await scroller.evaluate((el) => el.scrollTop)) < 5, 'panel scrolled back to the old insight target');
    await unitText('cytochrome c shuttles electrons').waitFor();
  });

  await check('source inspector shows the original passages', async () => {
    const unit = unitText('fermentation');
    await unit.hover();
    await unit.getByRole('button', { name: 'Show source passages' }).click();
    await page.getByRole('dialog').getByText('fermentation regenerates NAD+ when no oxygen.').waitFor();
  });
  await page.screenshot({ path: join(shots, '04-source-inspector.png') });
  await page.keyboard.press('Escape');

  await check('original view mirrors the raw document read-only', async () => {
    await page.getByRole('radio', { name: 'Original' }).click();
    await page.getByText('glycolysis net 2 ATP').waitFor();
    assert.equal(await page.getByText('ETC requires oxygen.').count(), 0);
  });
  await page.screenshot({ path: join(shots, '05-original-view.png') });
  await page.getByRole('radio', { name: 'Organized' }).click();

  await check('Summarize shows a concise summary in the notes\' outline and saves notes, insights and summary to a new Google Doc', async () => {
    await scroller.evaluate((el) => (el.scrollTop = 0));
    await page.getByRole('button', { name: /^Summarize/ }).click();
    const card = page.getByTestId('summary-card');
    await card.getByText(/Cells release energy from glucose in stages/).waitFor({ timeout: 30_000 });
    // Same outline as the organized notes: the notes' numbers and titles, in the notes' order.
    const noteHeadings = await page.evaluate(() =>
      Object.fromEntries([...document.querySelectorAll('article [id^="np-sec-"] button')].map((b) => [b.querySelector('span.min-w-0')?.textContent, b.textContent.replace(/\s+/g, ' ').trim()])),
    );
    const summaryHeadings = (await card.getByTestId('summary-section').locator('h3, h4, h5').allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
    const titles = summaryHeadings.map((h) => h.replace(/^[\d.]+\s*/, ''));
    for (const t of ['Glycolysis', 'Anaerobic Metabolism', 'Citric Acid Cycle', 'Electron Transport Chain']) assert.ok(titles.includes(t), `summary is missing ${t}`);
    for (const h of summaryHeadings) assert.equal(h, noteHeadings[h.replace(/^[\d.]+\s*/, '')], `summary heading "${h}" matches the notes`);
    const order = Object.keys(noteHeadings).filter((t) => titles.includes(t));
    assert.deepEqual(titles, order, 'summary sections follow the notes order');
    assert.equal(await card.locator('table').count(), 2, 'a compact table and the key terms table');
    assert.equal(await card.locator('ol > li').count(), 3, 'numbered steps');
    const open = card.getByRole('link', { name: /Open/ });
    await open.waitFor({ timeout: 30_000 });
    assert.equal(await open.getAttribute('href'), 'https://docs.google.com/document/d/e2e-companion-doc/edit');
    assert.equal(driveRequests.length, 1);
    const [first] = driveRequests;
    assert.equal(first.method, 'POST');
    assert.match(first.url, /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?uploadType=multipart/);
    assert.ok(first.body.includes('application/vnd.google-apps.document'));
    for (const part of ['<h1>Summary</h1>', '<h2>Key Terms</h2>', '<h1>Organized notes</h1>', 'Anaerobic Metabolism', '<h1>Insights</h1>', 'Check your understanding']) assert.ok(first.body.includes(part), `doc is missing ${part}`);
    assert.equal(aiLog.filter((e) => e.kind === 'summary').length, 1);
    // Keep the HTML that Google Drive would convert, for inspection.
    const html = first.body.slice(first.body.indexOf('<!DOCTYPE html>'), first.body.lastIndexOf('</html>') + 7);
    writeFileSync(join(shots, 'companion-doc.html'), html);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(shots, '10-summary.png') });
  {
    // The whole card, in a viewport tall enough that nothing scrolls.
    const vp = page.viewportSize();
    await page.setViewportSize({ width: vp.width, height: 2600 });
    await scroller.evaluate((el) => (el.scrollTop = 0));
    await page.waitForTimeout(200);
    await page.getByTestId('summary-card').screenshot({ path: join(shots, '10b-summary-card.png') });
    await page.setViewportSize(vp);
  }

  await check('summary section headings link to their sections in the notes', async () => {
    const secId = await page.evaluate(() => Object.values(window.__npView.organized.sections).find((s) => s.title === 'Anaerobic Metabolism').id);
    const before = await scroller.evaluate((el) => el.scrollTop);
    await page.getByTestId('summary-card').getByRole('button', { name: 'Anaerobic Metabolism' }).first().click();
    await page.waitForTimeout(1000);
    const top = await page.locator('#np-sec-' + secId).boundingBox();
    const after = await scroller.evaluate((el) => el.scrollTop);
    assert.ok(top && after > before && top.y >= 0 && top.y < 760, `section scrolled into view (y=${top?.y}, scrollTop ${before} → ${after}, max ${await scroller.evaluate((el) => el.scrollHeight - el.clientHeight)})`);
  });

  await check('summarizing again updates the same Google Doc instead of creating another', async () => {
    await scroller.evaluate((el) => (el.scrollTop = 0));
    await page.getByTestId('summary-card').getByRole('button', { name: 'Make a new summary' }).click();
    for (let t = 0; driveRequests.length < 2 && t < 300; t++) await page.waitForTimeout(100);
    await page.getByTestId('summary-card').getByRole('link', { name: /Open/ }).waitFor({ timeout: 30_000 });
    assert.equal(driveRequests.length, 2);
    assert.equal(driveRequests[1].method, 'PATCH');
    assert.match(driveRequests[1].url, /\/files\/e2e-companion-doc\?/);
    assert.equal(aiLog.filter((e) => e.kind === 'summary').length, 2, 'a new summary was requested (not served from cache)');
    assert.ok(driveRequests.every((r) => !r.url.includes(DOC_ID)), 'the notes doc is never a Drive target');
  });

  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(shots, '06-settings.png'), fullPage: false });
  await check('diagnostics report measured latency', async () => {
    await page.getByText('Change → sidebar (p50 / p90)').scrollIntoViewIfNeeded();
    const txt = await page.locator('dl').last().innerText();
    assert.match(txt, /\d+(\.\d)? s|\d+ ms/);
    log('   diagnostics:', txt.replace(/\n/g, ' | '));
  });
  await page.screenshot({ path: join(shots, '07-diagnostics.png') });

  await check('the Google Doc was only read (GET), never written', async () => {
    assert.ok(docsRequests.length > 5);
    const methods = [...new Set(docsRequests.map((r) => r.method))];
    assert.deepEqual(methods, ['GET']);
    assert.ok(driveRequests.every((r) => !r.url.includes(DOC_ID) && !r.body.includes(`"id":"${DOC_ID}"`)));
    assert.ok(docsRequests.every((r) => !/batchUpdate|:/.test(new URL(r.url).pathname.split('/documents/')[1] ?? '')));
    log(`   ${docsRequests.length} Docs API requests, all GET (${docsRequests.filter((r) => r.url.includes('fields=revisionId')).length} cheap revision checks)`);
  });

  await check('no console errors', async () => {
    assert.deepEqual(consoleErrors.filter((e) => !/favicon/i.test(e)), []);
  });

  // Dark-mode screenshot of the notes view.
  const dark = await context.newPage();
  await dark.emulateMedia({ colorScheme: 'dark' });
  await dark.goto(`chrome-extension://${extId}/sidepanel.html?doc=${DOC_ID}`);
  await dark.getByRole('heading', { name: /Glycolysis/ }).waitFor({ timeout: 20_000 });
  await dark.waitForTimeout(500);
  if (process.env.E2E_DEBUG) log('dark recent', await dark.evaluate(() => ({ now: Date.now(), role: window.__npView.role, recent: window.__npView.recent, upd: window.__npView.organized.updatedAt })));
  await dark.screenshot({ path: join(shots, '08-dark-mode.png') });
  await check('a second panel for the same doc mirrors the leader instead of double-processing', async () => {
    await dark.getByRole('tab', { name: 'Settings' }).click();
    await dark.getByText('mirroring another window').waitFor({ timeout: 10_000 });
  });

  // First-run setup screen (fresh settings, no AI key / consent yet).
  await dark.evaluate(async () => chrome.storage.local.set({ settings: { insightDepth: 'standard' } }));
  const setup = await context.newPage();
  await setup.goto(`chrome-extension://${extId}/sidepanel.html?doc=SETUP_DOC_0123456789abcdefgh`);
  await check('first run shows the guided setup and sends nothing before consent', async () => {
    await setup.getByText('Set up NotePilot').waitFor({ timeout: 15_000 });
    const before = aiLog.length;
    await setup.waitForTimeout(4000);
    assert.equal(aiLog.length, before);
  });
  await setup.screenshot({ path: join(shots, '09-setup.png') });
} finally {
  await context.close();
}

const failed = results.filter((r) => !r.ok);
log(`\n${results.length - failed.length}/${results.length} checks passed · AI calls: ${aiLog.filter((a) => a.kind === 'rewrite').length} rewrite, ${aiLog.filter((a) => a.kind === 'insights').length} insights, ${aiLog.filter((a) => a.kind === 'summary').length} summary · screenshots in ${shots}`);
process.exit(failed.length ? 1 : 0);
