// A right-click menu: opened at the pointer (or under a button), kept inside
// the window, driven by mouse or keys (arrows, Enter, Escape, → for a submenu).
//
// items: { label, onSelect, hint?, icon?, danger?, disabled?, checked?, items? (a submenu), indent? }
//        { sep: true }   a divider
//        { heading }     a small label

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const EDGE = 8;

function MenuList({ items, x, y, onClose, depth = 0, alignRight = false }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y, ready: false });
  const [active, setActive] = useState(-1);
  const [sub, setSub] = useState(null); // { ix, x, y, right }
  const usable = items.map((it, i) => (!it.sep && !it.heading && !it.disabled ? i : -1)).filter(i => i >= 0);

  // keep the whole menu on screen: flip left of the anchor, or lift above the bottom edge
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    let left = alignRight ? x - width : x;
    if (left + width > window.innerWidth - EDGE) left = window.innerWidth - width - EDGE;
    if (left < EDGE) left = EDGE;
    let top = y;
    if (top + height > window.innerHeight - EDGE) top = Math.max(EDGE, window.innerHeight - height - EDGE);
    setPos({ left, top, ready: true });
  }, [x, y, depth, alignRight]);

  useEffect(() => { if (depth === 0) ref.current?.focus(); }, [depth]);

  const openSub = (i) => {
    const row = ref.current?.querySelectorAll('[data-ix]')[i];
    if (!row) return;
    const b = row.getBoundingClientRect();
    const right = b.right + 220 > window.innerWidth - EDGE;
    setSub({ ix: i, x: right ? b.left + 4 : b.right - 4, y: b.top - 5, right });
  };

  const choose = (i) => {
    const it = items[i];
    if (!it || it.disabled || it.sep || it.heading) return;
    if (it.items) { openSub(i); return; }
    onClose(true);
    it.onSelect?.();
  };

  const onKeyDown = (e) => {
    if (sub) return; // the open submenu has the keys
    const at = usable.indexOf(active);
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(usable[(at + 1) % usable.length]); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(usable[(at - 1 + usable.length) % usable.length]); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(usable[0]); }
    else if (e.key === 'End') { e.preventDefault(); setActive(usable[usable.length - 1]); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (active >= 0) choose(active); }
    else if (e.key === 'ArrowRight' && items[active]?.items) { e.preventDefault(); openSub(active); }
    else if (e.key === 'Escape' || (e.key === 'ArrowLeft' && depth > 0)) { e.preventDefault(); e.stopPropagation(); onClose(false); }
    else if (e.key === 'Tab') { e.preventDefault(); onClose(false); }
  };

  return (
    <>
      <div
        ref={ref}
        role="menu"
        tabIndex={-1}
        className="ctx-menu"
        style={{ left: pos.left, top: pos.top, visibility: pos.ready ? 'visible' : 'hidden' }}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {items.map((it, i) => {
          if (it.sep) return <div key={i} className="ctx-sep" role="separator" />;
          if (it.heading) return <div key={i} className="ctx-heading">{it.heading}</div>;
          return (
            <div
              key={i}
              data-ix={i}
              role={it.checked === undefined ? 'menuitem' : 'menuitemradio'}
              aria-checked={it.checked}
              aria-disabled={it.disabled || undefined}
              aria-haspopup={it.items ? 'menu' : undefined}
              className={'ctx-item' + (i === active ? ' is-active' : '') + (it.danger ? ' is-danger' : '') + (it.disabled ? ' is-disabled' : '')}
              style={it.indent ? { paddingLeft: 10 + it.indent * 12 } : undefined}
              onMouseEnter={() => { if (it.disabled) return; setActive(i); if (it.items) openSub(i); else setSub(null); }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              <span className="ctx-icon" aria-hidden="true">{it.checked ? '✓' : it.icon}</span>
              <span className="ctx-label">{it.label}</span>
              {it.hint && <span className="ctx-hint">{it.hint}</span>}
              {it.items && <span className="ctx-hint" aria-hidden="true">›</span>}
            </div>
          );
        })}
      </div>
      {sub && items[sub.ix]?.items && (
        <MenuList
          items={items[sub.ix].items}
          x={sub.x} y={sub.y} alignRight={sub.right} depth={depth + 1}
          onClose={(chosen) => { setSub(null); if (chosen) onClose(true); else ref.current?.focus(); }}
        />
      )}
    </>
  );
}

/**
 * The menu, portalled to <body>. Closes on a press outside it, on scroll or
 * resize, on blur of the window, and hands focus back where it was.
 */
export default function ContextMenu({ menu, onClose }) {
  const restore = useRef(null);
  useEffect(() => {
    if (!menu) return undefined;
    restore.current = document.activeElement;
    const outside = (e) => { if (!e.target.closest?.('.ctx-menu')) onClose(); };
    const away = () => onClose();
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', away);
    window.addEventListener('blur', away);
    document.addEventListener('scroll', away, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('resize', away);
      window.removeEventListener('blur', away);
      document.removeEventListener('scroll', away, true);
    };
  }, [menu, onClose]);

  if (!menu) return null;
  const close = () => {
    onClose();
    // back to the row the menu was opened from, unless the choice moved focus on
    setTimeout(() => {
      if (document.activeElement === document.body || !document.activeElement) restore.current?.focus?.();
    }, 0);
  };
  return createPortal(<MenuList key={`${menu.x},${menu.y}`} items={menu.items} x={menu.x} y={menu.y} alignRight={menu.alignRight} onClose={close} />, document.body);
}
