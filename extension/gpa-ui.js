/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. MIT. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  root.CanvasHarnessGPAUI = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  let sequence = 0;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const copy = value => JSON.parse(JSON.stringify(value));
  const amount = value => new Intl.NumberFormat('en-US', {maximumFractionDigits: 4}).format(value);
  const gpa = value => value === null ? '—' : value.toFixed(2);
  const errorText = error => typeof error?.message === 'string' ? error.message : 'The calculator could not finish that action.';

  function create({container, store, getContext, onRefresh}) {
    const G = root.CanvasHarnessGPA || (typeof module === 'object' && module.exports ? require('./gpa-model.js') : null);
    if (!G || !container?.ownerDocument || !store?.get || !store?.update || typeof getContext !== 'function') throw Error('The GPA calculator needs its model, container, account store, and Canvas context.');
    const doc = container.ownerDocument, prefix = 'ch-gpa-' + (++sequence) + '-';
    const controls = new Map(), actions = new Map(), details = new Map(), openDetails = new Map(), edits = new Map();
    let prefs = G.defaults(), context = {}, panel, statusNode, bodyNode, draftNode, unsubscribe;
    let dead = false, busy = false, reveal = 'inherit', message = '', hasError = false, prefsError = '', owner = null;
    let ruleDraft = null, ruleDirty = false, pendingFocus = null;

    function node(tag, className, value) {
      const element = doc.createElement(tag);
      if (className) element.className = className;
      if (value !== undefined) element.textContent = String(value);
      return element;
    }
    function identity() {
      return String(store.owner?.origin || '') + '|' + String(store.owner?.accountId || context.accountId || context.user?.id || '');
    }
    function visible() { return reveal !== 'hide' && (reveal === 'show' || context.s?.showGrades === true); }
    function status(value, error = false) {
      message = value; hasError = error;
      if (statusNode) { statusNode.textContent = value || prefsError; statusNode.setAttribute('role', error || prefsError ? 'alert' : 'status'); }
    }
    function control(element, key, label, unavailable = false) {
      element.dataset.gpaControl = key;
      element.dataset.gpaUnavailable = String(unavailable);
      element.id = prefix + encodeURIComponent(key);
      element.setAttribute('aria-label', label);
      element.disabled = busy || unavailable;
      controls.set(key, element);
      if (edits.has(key)) element.value = edits.get(key);
      return element;
    }
    function button(action, label, primary = false) {
      const element = node('button', primary ? 'ch-gpa__button ch-gpa__button--primary' : 'ch-gpa__button', label);
      element.type = 'button'; element.dataset.gpaAction = action;
      element.disabled = busy && !['hide', 'reveal'].includes(action);
      actions.set(action, element);
      return element;
    }
    function select(key, label, value, options, unavailable = false) {
      const element = node('select', 'ch-gpa__input');
      for (const [id, title] of options) {
        const option = node('option', '', title); option.value = id; element.append(option);
      }
      element.value = value;
      return control(element, key, label, unavailable);
    }
    function numeric(key, label, value, min, max, unavailable = false) {
      const element = node('input', 'ch-gpa__input');
      element.type = 'number'; element.inputMode = 'decimal'; element.step = 'any'; element.min = String(min);
      if (max !== undefined) element.max = String(max);
      element.value = String(value); element.autocomplete = 'off';
      return control(element, key, label, unavailable);
    }
    function field(label, element, full = false) {
      const wrapper = node('label', 'ch-gpa__field' + (full ? ' ch-gpa__field--full' : ''));
      wrapper.htmlFor = element.id; wrapper.append(node('span', '', label), element);
      return wrapper;
    }
    function checkbox(key, label, checked, unavailable = false) {
      const input = node('input', 'ch-gpa__checkbox'); input.type = 'checkbox'; input.checked = checked;
      control(input, key, label, unavailable);
      const wrapper = node('label', 'ch-gpa__check'); wrapper.htmlFor = input.id;
      wrapper.append(input, node('span', '', label)); return wrapper;
    }
    function disclosure(key, title, className = 'ch-gpa__details') {
      const element = node('details', className); element.open = openDetails.get(key) === true;
      const summary = node('summary', 'ch-gpa__summary', title); summary.dataset.gpaDetail = key;
      element.append(summary); details.set(key, element);
      return element;
    }
    function captureFocus() {
      const active = container.getRootNode?.().activeElement || doc.activeElement;
      return active && container.contains(active) ? {key: active.dataset.gpaControl, action: active.dataset.gpaAction,
        detail: active.dataset.gpaDetail, start: active.selectionStart, end: active.selectionEnd} : null;
    }
    function syncRuleDraft() {
      ruleDraft = {rules: copy(prefs.rules), presets: {...prefs.presets}, bonusOnFail: prefs.bonusOnFail,
        capEnabled: prefs.weightedCap !== null, weightedCap: prefs.weightedCap ?? 5};
    }
    function readState() {
      try { context = getContext() || {}; }
      catch (error) { context = {}; status(errorText(error), true); }
      const nextOwner = identity();
      if (owner !== null && owner !== nextOwner) {
        reveal = 'inherit'; prefs = G.defaults(); ruleDraft = null; ruleDirty = false;
        edits.clear(); openDetails.clear(); pendingFocus = null; message = ''; hasError = false; prefsError = '';
      }
      owner = nextOwner;
      if (!busy) {
        try { prefs = G.cleanPreferences(store.get()?.gpa); prefsError = ''; }
        catch (error) { prefsError = 'Saved calculator preferences could not be read. The last valid rules are retained. ' + errorText(error); }
      }
      if (!ruleDirty || !ruleDraft) syncRuleDraft();
    }
    function preparedCourses() {
      const all = Array.isArray(context.allCourses) ? context.allCourses : Array.isArray(context.courses) ? context.courses : [];
      const selected = Array.isArray(context.courses) ? new Set(context.courses.filter(Boolean).map(c => String(c.id))) : null;
      const hiddenCourses = new Set((Array.isArray(context.s?.hiddenCourses) ? context.s.hiddenCourses : []).map(String));
      let nonAcademic = new Set();
      if (typeof root.ReserveCore?.nonAcademicCourseIds === 'function') nonAcademic = root.ReserveCore.nonAcademicCourseIds(all);
      return all.map(course => course && ({...course,
        academic: course.academic !== false && course.isAcademic !== false && course.nonAcademic !== true && !nonAcademic.has(String(course.id)),
        selected: course.selected !== false && (!selected || selected.has(String(course.id))) && !hiddenCourses.has(String(course.id))
      }));
    }
    function syncBusy() {
      if (panel) panel.setAttribute('aria-busy', String(busy));
      for (const element of controls.values()) element.disabled = busy || element.dataset.gpaUnavailable === 'true';
      for (const [action, element] of actions) element.disabled = busy && !['hide', 'reveal'].includes(action);
      if (actions.has('apply-rules')) actions.get('apply-rules').disabled = busy || !ruleDirty;
      if (actions.has('cancel-rules')) actions.get('cancel-rules').disabled = busy || !ruleDirty;
    }
    function markRulesDirty() {
      ruleDirty = true;
      if (draftNode) draftNode.textContent = 'Unsaved rule edits. Results still use your saved rules.';
      syncBusy();
    }
    function resultPair(parent, values, weighted, custom) {
      const section = node('section', 'ch-gpa__results' + (weighted ? ' ch-gpa__results--weighted' : ''));
      section.setAttribute('aria-label', weighted ? 'Weighted GPA with course-level bonuses and credits' : 'Unweighted GPA with credits, without course-level bonuses');
      section.append(node('p', 'ch-gpa__result-label', weighted ? 'Weighted · course-level bonuses' : 'Unweighted · no level bonus'));
      const grid = node('div', 'ch-gpa__result-grid');
      for (const [key, label] of [['scale4', '4.0'], ['scale43', '4.3']]) {
        const card = node('div', 'ch-gpa__result');
        card.append(node('span', 'ch-gpa__scale', label + (custom ? ' table · custom' : ' scale')));
        const output = node('output', 'ch-gpa__number', gpa(values[key]));
        output.setAttribute('aria-label', (weighted ? 'Weighted ' : 'Unweighted ') + label + ': ' + (values[key] === null ? 'not available' : gpa(values[key])));
        card.append(output); grid.append(card);
      }
      section.append(grid); parent.append(section);
    }
    function actualGrade(row) {
      if (row.reason === 'hidden') return 'Hidden by Canvas';
      const mark = row.canvasLabel || (row.canvasPercent !== null ? String(row.canvasPercent) + '%' : 'unavailable');
      return row.canvasLabel && row.canvasPercent !== null ? mark + ' · ' + String(row.canvasPercent) + '%' : mark;
    }
    function courseCard(row) {
      const card = node('article', 'ch-gpa__course');
      const include = checkbox('course:' + row.id + ':included', 'Include ' + row.name, row.include, row.reason === 'hidden');
      include.className += ' ch-gpa__include'; include.children[1].className = 'ch-gpa__sr-only';
      card.append(include);
      const content = disclosure('course:' + row.id, '', 'ch-gpa__course-details');
      const summary = content.children[0];
      const name = node('span', 'ch-gpa__course-name', row.name);
      name.append(node('span', 'ch-gpa__course-meta', row.reasonText || row.periodLabel + ' · ' + amount(row.credits) + (row.credits === 1 ? ' credit' : ' credits')));
      const mark = row.letter ? (row.manual ? 'What-if ' : '') + row.letter : row.reason === 'hidden' ? 'Hidden' : row.canvasLabel || 'No grade';
      summary.append(name, node('span', 'ch-gpa__course-grade', mark));
      const editor = node('div', 'ch-gpa__course-editor');
      const source = row.source === 'percentage' ? 'Converted from ' + String(row.canvasPercent) + '% using your rules.'
        : row.manual ? 'What-if ' + row.letter + '. Canvas grade: ' + actualGrade(row) + '.'
        : 'Canvas grade: ' + actualGrade(row) + '.';
      editor.append(node('p', 'ch-gpa__hint', source));
      const fields = node('div', 'ch-gpa__fields');
      fields.append(field('Credits', numeric('course:' + row.id + ':credits', row.name + ' credits', row.credits, 0, 30)));
      const savedCourse = own(prefs.courses, row.id) ? prefs.courses[row.id] : null;
      const override = savedCourse?.override || '';
      fields.append(field('Grade override (what-if)', select('course:' + row.id + ':override', row.name + ' what-if letter grade', override,
        [['', 'Use Canvas grade'], ...G.LETTERS.map(value => [value, value + ' · what-if'])], row.reason === 'hidden')));
      if (prefs.weighted) {
        fields.append(field('Course level', select('course:' + row.id + ':level', row.name + ' course level', row.level,
          [['regular', 'Regular (+' + amount(prefs.presets.regular) + ')'], ['honors', 'Honors (+' + amount(prefs.presets.honors) + ')'], ['ap', 'AP / IB (+' + amount(prefs.presets.ap) + ')'], ['custom', 'Custom bonus']])));
        if (row.level === 'custom') fields.append(field('Custom bonus', numeric('course:' + row.id + ':bonus', row.name + ' custom level bonus', savedCourse?.bonus ?? 0, 0, 5)));
      }
      editor.append(fields);
      if (row.eligible) editor.append(node('p', 'ch-gpa__hint', 'Base points: ' + amount(row.points4) + ' (4.0 table) · ' + amount(row.points43) + ' (4.3 table).' +
        (prefs.weighted ? ' Applied bonus: +' + amount(row.appliedBonus) + '.' : '')));
      if (row.manual) editor.append(node('p', 'ch-gpa__what-if', 'What-if only. This does not change the grade in Canvas.'));
      content.append(editor); card.append(content); return card;
    }
    function rulesView() {
      const box = disclosure('rules', 'Conversion & weighting rules');
      const inner = node('div', 'ch-gpa__rules');
      inner.append(node('p', 'ch-gpa__hint', 'These are editable defaults, not official school rules. Exact Canvas letter grades take priority; percentages use the minimums below without rounding.'));
      const table = node('table', 'ch-gpa__table');
      table.append(node('caption', 'ch-gpa__sr-only', 'Minimum percentages and points for each letter grade'));
      const head = node('thead'), headings = node('tr');
      for (const title of ['Letter', 'Min %', '4.0 pts', '4.3 pts']) { const cell = node('th', '', title); cell.scope = 'col'; headings.append(cell); }
      head.append(headings); table.append(head);
      const body = node('tbody');
      ruleDraft.rules.forEach((rule, index) => {
        const row = node('tr'), title = node('th', '', rule.letter); title.scope = 'row'; row.append(title);
        for (const key of ['min', 'points4', 'points43']) {
          const cell = node('td'); cell.append(numeric('rule:' + index + ':' + key,
            rule.letter + (key === 'min' ? ' minimum percentage' : key === 'points4' ? ' 4.0-table points' : ' 4.3-table points'), rule[key], 0, key === 'min' ? undefined : 10));
          row.append(cell);
        }
        body.append(row);
      });
      table.append(body); inner.append(table);
      inner.append(node('p', 'ch-gpa__hint', 'Minimums must decrease with no duplicates; F starts at 0%. Points may range from 0 to 10. Custom points can exceed the named base scale.'));
      inner.append(node('h3', 'ch-gpa__subheading', 'Level bonuses'));
      const presets = node('div', 'ch-gpa__presets');
      for (const [key, label] of [['regular', 'Regular'], ['honors', 'Honors'], ['ap', 'AP / IB']]) {
        presets.append(field(label, numeric('preset:' + key, label + ' level bonus preset', ruleDraft.presets[key], 0, 5)));
      }
      inner.append(presets, node('p', 'ch-gpa__hint', 'Apply a level in each course’s controls. Names never choose a bonus automatically. Changing a preset updates courses using that level.'));
      inner.append(checkbox('bonusOnFail', 'Apply a level bonus to F grades', ruleDraft.bonusOnFail));
      inner.append(checkbox('capEnabled', 'Cap each course’s weighted points', ruleDraft.capEnabled));
      inner.append(field('Weighted point cap (4–10)', numeric('weightedCap', 'Per-course weighted point cap', ruleDraft.weightedCap, 4, 10, !ruleDraft.capEnabled)));
      inner.append(node('p', 'ch-gpa__hint', 'No cap is applied when the option is off. Unweighted results never receive a level bonus.'));
      draftNode = node('p', 'ch-gpa__draft-note', ruleDirty ? 'Unsaved rule edits. Results still use your saved rules.' : 'Rules are saved for this Canvas account.');
      const buttons = node('div', 'ch-gpa__actions'); buttons.append(button('apply-rules', 'Apply rules', true), button('cancel-rules', 'Discard edits'));
      inner.append(draftNode, buttons); box.append(inner); return box;
    }
    function render() {
      if (dead) return;
      const active = container.getRootNode?.().activeElement || doc.activeElement;
      // Disabling a focused input or a synchronous store notification can move
      // focus to the document body. Retain its key, without stealing focus back
      // from an intentionally selected control elsewhere in the Canvas page.
      const liveFocus = captureFocus();
      const canRestore = !active || active === doc.body || active === doc.documentElement || active === container.getRootNode?.().host || active.isConnected === false;
      const focus = liveFocus || (canRestore ? pendingFocus : null);
      if (liveFocus) pendingFocus = liveFocus;
      const scroll = bodyNode?.scrollTop || 0;
      for (const [key, element] of details) openDetails.set(key, element.open);
      controls.clear(); actions.clear(); details.clear(); draftNode = null;
      panel = node('section', 'ch-gpa'); panel.setAttribute('aria-labelledby', prefix + 'title');
      panel.dataset.gpaMotion = ['off', 'still'].includes(context.s?.motionStyle || context.s?.motion) ? 'off' : 'standard';
      const top = node('header', 'ch-gpa__top'), heading = node('div', 'ch-gpa__heading');
      const title = node('h2', 'ch-gpa__title', 'GPA estimate'); title.id = prefix + 'title'; heading.append(title);
      if (visible()) { const options = node('div', 'ch-gpa__actions'); options.append(button('refresh', 'Refresh'), button('hide', 'Hide')); heading.append(options); }
      top.append(heading, node('p', 'ch-gpa__disclaimer', 'Estimate from available Canvas grades; not official transcript GPA.'));
      panel.append(top);
      bodyNode = node('div', 'ch-gpa__body'); panel.append(bodyNode);
      if (!visible()) {
        const gate = node('div', 'ch-gpa__privacy');
        gate.append(node('h3', 'ch-gpa__privacy-title', 'Your grades stay private'),
          node('p', 'ch-gpa__hint', 'Reveal the calculator in this dock for this visit. This does not turn on dashboard grades.'), button('reveal', 'Show GPA here', true));
        bodyNode.append(gate);
      } else {
        // The privacy gate is above both calculation and all grade-bearing DOM creation.
        const result = G.calculate(preparedCourses(), prefs);
        resultPair(top, result.unweighted, false, result.customRules);
        if (result.weighted) resultPair(top, result.weighted, true, result.customRules);
        top.append(node('p', 'ch-gpa__count', result.countedCourses + ' of ' + result.totalCourses + ' courses · ' + amount(result.totalCredits) + ' credits'));
        const settings = node('div', 'ch-gpa__settings');
        settings.append(field('Grade source', select('scope', 'Grade source for all courses', prefs.scope,
          [['overall', 'Overall Canvas grades'], ['current-period', 'Current grading period']])));
        settings.append(checkbox('weighted', 'Show weighted GPA', prefs.weighted)); bodyNode.append(settings);
        bodyNode.append(node('p', 'ch-gpa__hint', 'Both averages use course credits. “Unweighted” means no level bonus. Each course starts at 1 credit for equal importance. Results show 2 decimal places.'));
        if (!result.countedCourses) bodyNode.append(node('p', 'ch-gpa__notice', 'No eligible courses to calculate. Review exclusions, selected courses, and credits below.'));
        if (result.mixedPeriods) bodyNode.append(node('p', 'ch-gpa__notice', 'Mixed grading periods: ' + result.periods.join(' · ') + '. These courses do not share one period.'));
        if (result.whatIfCount) bodyNode.append(node('p', 'ch-gpa__what-if', 'Includes ' + result.whatIfCount + ' what-if grade' + (result.whatIfCount === 1 ? '' : 's') + '. Canvas grades are unchanged.'));
        if (result.excludedCourses) {
          const reasons = Object.entries(result.exclusions).map(([key, count]) => count + ' ' + G.REASONS[key].toLowerCase());
          bodyNode.append(node('p', 'ch-gpa__exclusions', result.excludedCourses + ' excluded: ' + reasons.join('; ') + '.'));
        }
        for (const warning of result.warnings) bodyNode.append(node('p', 'ch-gpa__notice', warning));
        const list = node('div', 'ch-gpa__courses'); list.setAttribute('aria-label', 'Course selection and what-if controls');
        for (const row of result.rows) list.append(courseCard(row));
        bodyNode.append(list, rulesView());
        const reset = node('div', 'ch-gpa__reset'); reset.append(button('reset', 'Reset calculator preferences'));
        bodyNode.append(reset);
      }
      statusNode = node('p', 'ch-gpa__status', visible() ? message || prefsError : prefsError);
      statusNode.setAttribute('role', hasError || prefsError ? 'alert' : 'status'); statusNode.setAttribute('aria-live', 'polite');
      panel.append(statusNode); container.replaceChildren(panel); bodyNode.scrollTop = scroll;
      syncBusy();
      const replacement = focus?.key ? controls.get(focus.key) : focus?.action ? actions.get(focus.action) : focus?.detail ? details.get(focus.detail)?.children[0] : null;
      if (replacement && !replacement.disabled) {
        replacement.focus({preventScroll: true});
        if (typeof focus.start === 'number' && typeof replacement.setSelectionRange === 'function') {
          try { replacement.setSelectionRange(focus.start, focus.end); } catch (_) { /* Number inputs do not expose a text selection. */ }
        }
      }
      if (!busy) pendingFocus = null;
    }
    function update() {
      if (dead) return;
      try { readState(); render(); }
      catch (error) { status(errorText(error), true); }
    }

    async function save(candidate, success, {editedKey, resetRules = false, resetAll = false} = {}) {
      if (dead || busy) return;
      let clean;
      try { clean = G.cleanPreferences(candidate); }
      catch (error) {
        if (editedKey) controls.get(editedKey)?.setAttribute('aria-invalid', 'true');
        status(errorText(error) + ' Your saved preferences are unchanged.', true); return;
      }
      const expectedOwner = owner;
      pendingFocus = captureFocus() || pendingFocus;
      busy = true; status('Saving calculator preferences…'); syncBusy();
      try {
        await store.update(data => {
          if (dead || identity() !== expectedOwner) throw Error('The Canvas account changed or the calculator closed before saving.');
          data.gpa = copy(clean);
        });
        if (dead) return;
        if (identity() !== expectedOwner) throw Error('The Canvas account changed. Reopen the calculator for that account.');
        prefs = clean;
        if (editedKey) edits.delete(editedKey);
        if (resetAll) { edits.clear(); openDetails.clear(); }
        if (resetRules || resetAll) { ruleDirty = false; syncRuleDraft(); }
        status(success);
      } catch (error) { if (!dead) status(errorText(error), true); }
      finally { busy = false; if (!dead) update(); }
    }
    function ruleInput(key, element) {
      const parts = key.split(':');
      if (parts[0] === 'rule') ruleDraft.rules[Number(parts[1])][parts[2]] = element.value;
      else if (parts[0] === 'preset') ruleDraft.presets[parts[1]] = element.value;
      else if (key === 'bonusOnFail') ruleDraft.bonusOnFail = element.checked;
      else if (key === 'capEnabled') {
        ruleDraft.capEnabled = element.checked;
        const cap = controls.get('weightedCap'); if (cap) cap.dataset.gpaUnavailable = String(!element.checked);
      } else if (key === 'weightedCap') ruleDraft.weightedCap = element.value;
      else return false;
      element.removeAttribute('aria-invalid'); markRulesDirty(); return true;
    }
    function input(event) {
      if (dead || busy || !visible()) return;
      const element = event.target, key = element?.dataset?.gpaControl;
      if (!key || !controls.has(key)) return;
      if (!ruleInput(key, element) && element.type !== 'checkbox' && element.tagName !== 'SELECT') edits.set(key, element.value);
    }
    function change(event) {
      if (dead || busy || !visible()) return;
      const element = event.target, key = element?.dataset?.gpaControl;
      if (!key || !controls.has(key) || element.disabled) return;
      if (ruleInput(key, element)) return;
      const next = copy(prefs);
      if (key === 'scope') next.scope = element.value;
      else if (key === 'weighted') next.weighted = element.checked;
      else if (key.startsWith('course:')) {
        // Opaque course IDs can contain colons; only the final component is a field.
        const end = key.lastIndexOf(':'), id = key.slice(7, end), fieldName = key.slice(end + 1);
        const item = own(next.courses, id) ? next.courses[id] : {credits: 1, level: 'regular', bonus: 0, override: null};
        item[fieldName] = fieldName === 'included' ? element.checked : fieldName === 'override' ? element.value || null : element.value;
        if (fieldName === 'override' && item.override) item.included = true;
        if (element.type === 'number') edits.set(key, element.value);
        next.courses[id] = item;
      } else return;
      void save(next, 'Calculator updated.', {editedKey: key});
    }
    async function refresh() {
      if (dead || busy) return;
      if (typeof onRefresh !== 'function') { status('Refresh Canvas to update grades.'); return; }
      pendingFocus = captureFocus() || pendingFocus;
      busy = true; status('Refreshing available Canvas grades…'); syncBusy();
      try { await onRefresh(); if (!dead) status('Canvas refresh finished.'); }
      catch (error) { if (!dead) status(errorText(error), true); }
      finally { busy = false; if (!dead) update(); }
    }
    function click(event) {
      const element = event.target?.closest?.('[data-gpa-action]');
      if (dead || !element || !container.contains(element) || element.disabled) return;
      const action = element.dataset.gpaAction; event.preventDefault();
      if (action === 'reveal') { reveal = 'show'; status(''); update(); focus(); return; }
      if (action === 'hide') { reveal = 'hide'; status(''); update(); focus(); return; }
      if (!visible() || busy) return;
      if (action === 'refresh') { void refresh(); return; }
      if (action === 'reset') { void save(G.defaults(), 'Calculator preferences reset.', {resetAll: true}); return; }
      if (action === 'cancel-rules') { ruleDirty = false; syncRuleDraft(); status('Unsaved rule edits discarded.'); render(); return; }
      if (action === 'apply-rules') {
        const next = {...prefs, rules: copy(ruleDraft.rules), presets: {...ruleDraft.presets}, bonusOnFail: ruleDraft.bonusOnFail,
          weightedCap: ruleDraft.capEnabled ? ruleDraft.weightedCap : null};
        void save(next, 'Conversion and weighting rules saved.', {resetRules: true});
      }
    }
    function focus() { (visible() ? controls.get('scope') : actions.get('reveal'))?.focus({preventScroll: true}); }
    function destroy() {
      if (dead) return;
      dead = true;
      if (typeof unsubscribe === 'function') unsubscribe();
      container.removeEventListener('click', click); container.removeEventListener('input', input); container.removeEventListener('change', change);
      container.replaceChildren(); controls.clear(); actions.clear(); details.clear(); openDetails.clear(); edits.clear();
      ruleDraft = null; prefs = null; context = {}; pendingFocus = null; panel = statusNode = bodyNode = draftNode = null;
    }
    container.addEventListener('click', click); container.addEventListener('input', input); container.addEventListener('change', change);
    if (typeof store.subscribe === 'function') unsubscribe = store.subscribe(update);
    update();
    return {update, focus, destroy};
  }

  return Object.freeze({create});
});
