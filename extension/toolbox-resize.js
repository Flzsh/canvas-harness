/*! @preserve Canvas Harness original creator: Flzsh. Project: org.flzsh.canvas-harness. Third-party components retain their respective attribution. */
(function (root) {
  'use strict';
  const KEY_DELAY = 250, SIZE_HINT = 'Panel size (drag the top or left edge for a custom size)';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const dimension = value => Number.isFinite(value) && value >= 0 ? Math.min(10000, value) : 0;
  const preferences = value => ({width:dimension(value?.width), height:dimension(value?.height)});
  const same = (a, b) => a?.width === b?.width && a?.height === b?.height;

  function getBounds(viewport) {
    const width = Math.max(0, Number.isFinite(viewport?.width) ? viewport.width : 0);
    const height = Math.max(0, Number.isFinite(viewport?.height) ? viewport.height : 0);
    const narrow = width <= 900;
    const maxWidth = narrow ? Math.max(0, width - 24) : Math.min(900, width - 560);
    const maxHeight = Math.max(0, Math.floor(narrow ? height * .75 : height - 32));
    return {
      narrow,
      minWidth:narrow ? maxWidth : Math.min(320, maxWidth), maxWidth,
      minHeight:Math.min(narrow ? 240 : 320, maxHeight), maxHeight,
      defaultWidth:narrow ? maxWidth : Math.round(clamp(width * .29, 360, 460)),
      defaultHeight:Math.round(narrow ? height * .46 : height - 104)
    };
  }

  function clampSize(value, b) {
    return {
      width:clamp(Math.round(b.narrow ? b.maxWidth : value.width), b.minWidth, b.maxWidth),
      height:clamp(Math.round(value.height), b.minHeight, b.maxHeight)
    };
  }

  function resolveSize(value, viewport) {
    const prefs = preferences(value), b = getBounds(viewport);
    return clampSize({width:prefs.width || b.defaultWidth, height:prefs.height || b.defaultHeight}, b);
  }

  function presetSize(name, viewport) {
    if (name === 'auto') return {width:0, height:0};
    const b = getBounds(viewport);
    const preset = {wide:{width:640, height:0}, tall:{width:0, height:b.maxHeight}, compact:{width:360, height:b.narrow ? b.minHeight : 420}}[name];
    if (!preset) return null;
    const size = resolveSize(preset, viewport);
    return {width:b.narrow ? 0 : size.width, height:size.height};
  }

  function create({dialog, container, store, onSize = () => {}}) {
    const document = dialog.ownerDocument, window = document.defaultView || root;
    const listeners = [], dragListeners = [], handles = {};
    const viewport = () => ({width:window.innerWidth, height:window.innerHeight});
    let prefs = preferences(store.get().toolbox?.dockSize), observed = {...prefs};
    let size = null, drag = null, timer = null, dirty = false, dead = false, revision = 0, saving = 0;
    const originalStyles = ['--rd-dock-width','--rd-dock-height'].map(name => [name, container.style.getPropertyValue(name), container.style.getPropertyPriority(name)]);
    const select = document.createElement('select');
    select.className = 'rd-dock-size';
    select.setAttribute('aria-label', 'Toolbox size');
    select.title = SIZE_HINT;
    for (const [value, label] of [['auto','Auto'],['wide','Wide'],['tall','Tall'],['compact','Compact'],['custom','Custom']]) {
      const option = document.createElement('option');
      option.value = value; option.textContent = label; option.disabled = value === 'custom';
      select.append(option);
    }
    const actions = dialog.querySelector('.rd-utility-heading-actions');
    actions?.insertBefore(select, actions.querySelector('[data-ui-action="collapse"]'));

    function listen(target, type, handler, temporary = false) {
      // Capture survives parent handlers that stop events at the toolbox boundary.
      target.addEventListener(type, handler, true);
      (temporary ? dragListeners : listeners).push(() => target.removeEventListener(type, handler, true));
    }
    function clearTimer() { if (timer !== null) window.clearTimeout(timer); timer = null; }
    function interactive() { return dialog.open && dialog.dataset.collapsed !== 'true'; }
    function syncPreset() {
      select.value = same(prefs, {width:0,height:0}) ? 'auto' :
        ['wide','tall','compact'].find(name => same(prefs, presetSize(name, viewport()))) || 'custom';
    }
    function apply() {
      if (dead) return;
      const next = resolveSize(prefs, viewport()), b = getBounds(viewport());
      container.style.setProperty('--rd-dock-width', next.width + 'px');
      container.style.setProperty('--rd-dock-height', next.height + 'px');
      for (const axis of ['width','height']) {
        const handle = handles[axis], title = axis === 'width' ? 'Width' : 'Height';
        handle.setAttribute('aria-valuemin', String(b['min' + title]));
        handle.setAttribute('aria-valuemax', String(b['max' + title]));
        handle.setAttribute('aria-valuenow', String(next[axis]));
        handle.hidden = !interactive() || axis === 'width' && b.narrow;
        handle.tabIndex = handle.hidden ? -1 : 0;
      }
      handles.both.hidden = !interactive() || b.narrow;
      select.hidden = !interactive();
      syncPreset();
      const changed = !same(size, next); size = next;
      if (changed) onSize({...size});
    }
    async function persist() {
      clearTimer();
      if (dead || drag || !dirty) return;
      const snapshot = {...prefs}, version = revision;
      dirty = false; saving++;
      try {
        await store.update(data => {
          // Mutate only size inside the store's latest account snapshot.
          data.toolbox.dockSize = {...data.toolbox.dockSize, ...snapshot};
        });
        if (!dead && version === revision) select.title = SIZE_HINT;
      } catch {
        if (!dead && version === revision) {
          dirty = true;
          select.title = 'Toolbox size could not be saved. Your other work is unchanged; resize again to retry.';
        }
      } finally { saving--; }
    }
    function scheduleSave() {
      clearTimer();
      if (!dead && dirty && !drag) timer = window.setTimeout(() => { timer = null; void persist(); }, KEY_DELAY);
    }
    function setPrefs(next) {
      if (same(prefs, next)) return;
      prefs = next; dirty = true; revision++; apply();
    }
    function endDrag(commit, event) {
      if (!drag || event?.pointerId !== undefined && event.pointerId !== drag.id) return;
      if (commit && event) move(event);
      if (!drag) return;
      const active = drag; drag = null;
      for (const remove of dragListeners.splice(0)) remove();
      delete container.dataset.resizing; delete dialog.dataset.resizing;
      try { if (active.handle.hasPointerCapture(active.id)) active.handle.releasePointerCapture(active.id); } catch { /* A removed pointer may already have released capture. */ }
      if (!commit) {
        prefs = active.prefs; dirty = active.dirty; revision++;
        if (!dead) { apply(); scheduleSave(); }
      } else void persist();
    }
    function move(event) {
      if (!drag || event.pointerId !== drag.id) return;
      if (event.type === 'pointermove' && event.buttons === 0) { endDrag(false); return; }
      const proposed = {...drag.size};
      if (drag.axis !== 'height' && Number.isFinite(event.clientX)) proposed.width += drag.x - event.clientX;
      if (drag.axis !== 'width' && Number.isFinite(event.clientY)) proposed.height += drag.y - event.clientY;
      const next = clampSize(proposed, getBounds(viewport())), value = {...drag.prefs};
      // An untouched axis stays automatic; a click without movement saves nothing.
      if (drag.axis !== 'height' && next.width !== drag.size.width) value.width = next.width;
      if (drag.axis !== 'width' && next.height !== drag.size.height) value.height = next.height;
      setPrefs(value);
      dirty = drag.dirty || !same(prefs, drag.prefs);
      event.preventDefault();
    }
    function startDrag(event, axis) {
      if (dead || drag || !interactive() || event.button !== 0 || event.isPrimary === false || getBounds(viewport()).narrow && axis !== 'height') return;
      if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
      const handle = handles[axis];
      try { handle.setPointerCapture(event.pointerId); } catch { return; }
      container.dataset.input = 'pointer';
      clearTimer();
      drag = {handle, axis, id:event.pointerId, x:event.clientX, y:event.clientY, size:{...size}, prefs:{...prefs}, dirty};
      container.dataset.resizing = 'true'; dialog.dataset.resizing = 'true';
      listen(window, 'pointermove', move, true);
      listen(window, 'pointerup', event => endDrag(true, event), true);
      listen(window, 'pointercancel', event => endDrag(false, event), true);
      listen(handle, 'lostpointercapture', event => endDrag(false, event), true);
      listen(window, 'blur', () => endDrag(false), true);
      listen(window, 'keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); endDrag(false); }
      }, true);
      listen(document, 'visibilitychange', () => { if (document.hidden) endDrag(false); }, true);
      event.preventDefault(); event.stopPropagation();
    }
    function keydown(event, axis) {
      if (dead || drag || !interactive() || axis === 'both' || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || getBounds(viewport()).narrow && axis === 'width') return;
      const changes = axis === 'width' ? {ArrowLeft:1,ArrowRight:-1} : {ArrowUp:1,ArrowDown:-1};
      if (event.key !== 'Home' && !changes[event.key]) return;
      container.dataset.input = 'keyboard';
      event.preventDefault(); event.stopPropagation();
      const next = {...prefs};
      if (event.key === 'Home') next[axis] = 0;
      else {
        const target = {...size, [axis]:size[axis] + changes[event.key] * (event.shiftKey ? 48 : 16)};
        const value = clampSize(target, getBounds(viewport()))[axis];
        if (value === size[axis]) return;
        next[axis] = value;
      }
      setPrefs(next); scheduleSave();
    }
    for (const axis of ['width','height','both']) {
      const handle = document.createElement('div');
      handle.className = 'rd-dock-resize'; handle.dataset.resize = axis;
      if (axis === 'both') { handle.title = 'Resize toolbox'; handle.setAttribute('aria-hidden','true'); }
      else {
        handle.setAttribute('role','separator');
        handle.setAttribute('aria-orientation',axis === 'width' ? 'vertical' : 'horizontal');
        handle.setAttribute('aria-label','Toolbox ' + axis);
        handle.title = 'Resize toolbox ' + axis + ' (arrow keys, Shift for larger steps, Home to reset)';
      }
      handles[axis] = handle; dialog.append(handle);
      listen(handle, 'pointerdown', event => startDrag(event, axis));
      if (axis !== 'both') listen(handle, 'keydown', event => keydown(event, axis));
    }
    listen(select, 'change', () => {
      if (dead) return;
      const next = presetSize(select.value, viewport());
      if (!next) { syncPreset(); return; }
      endDrag(false); setPrefs(next); void persist();
    });
    function refresh() {
      if (dead) return;
      if (drag && !interactive()) endDrag(false);
      apply();
    }
    listen(window, 'resize', () => { endDrag(false); refresh(); });
    listen(dialog, 'close', () => { endDrag(false); refresh(); });
    const unsubscribe = store.subscribe?.(data => {
      if (dead) return;
      const next = preferences(data.toolbox?.dockSize), changed = !same(next, observed);
      observed = next;
      if (changed && !dirty && !drag && !saving) { prefs = next; revision++; apply(); }
    });
    apply();
    return {
      refresh,
      getSize:() => ({...size}),
      destroy() {
        if (dead) return;
        dead = true; clearTimer(); endDrag(false); unsubscribe?.();
        for (const remove of listeners.splice(0)) remove();
        select.remove(); for (const handle of Object.values(handles)) handle.remove();
        for (const [name,value,priority] of originalStyles) {
          if (value) container.style.setProperty(name,value,priority);
          else container.style.removeProperty(name);
        }
      }
    };
  }
  const api = {create, getBounds, resolveSize, presetSize};
  root.ReserveToolboxResize = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
