import { KBD } from '../data.js';
import { docStats } from '../markdown.jsx';

// what the vault store reports, in words; the dot is the same signal at a glance
const SAVE_LABEL = {
  saved: { text: 'saved', color: 'var(--ok)', tip: 'Saved in this browser' },
  saving: { text: 'saving…', color: 'var(--ink-3)', tip: 'Saving your latest changes' },
  error: { text: 'not saved — retrying', color: 'var(--danger)' },
  unsaved: { text: 'not kept on this device', color: 'var(--danger)', tip: 'This browser does not let Inkwell store data (a private window?). Export your vault from Settings before closing.' },
};

export default function StatusBar({ doc, hasNote, save = { status: 'saved' } }) {
  const { words, sketches, tasks } = docStats(doc);
  const label = SAVE_LABEL[save.status] || SAVE_LABEL.saved;
  const trouble = save.status === 'error' || save.status === 'unsaved';
  const tip = save.status === 'error'
    ? `Saving failed: ${save.error?.message || 'unknown error'}. Your changes are kept and will be saved again.`
    : label.tip;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 14px', background: 'var(--bg-panel)', borderTop: '1px solid var(--line)', fontSize: '11.5px', color: 'var(--ink-3)', flexShrink: 0 }}>
      <div>
        {hasNote
          ? `${words} ${words === 1 ? 'word' : 'words'} · ${sketches} ${sketches === 1 ? 'sketch' : 'sketches'} · ${tasks} ${tasks === 1 ? 'task' : 'tasks'}`
          : 'no note open'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <span>{KBD} quick switcher</span>
        <span role="status" title={tip} style={{ display: 'flex', alignItems: 'center', gap: '5px', color: trouble ? 'var(--danger)' : undefined }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: label.color, display: 'inline-block' }} />
          {label.text} · this device
        </span>
      </div>
    </div>
  );
}
