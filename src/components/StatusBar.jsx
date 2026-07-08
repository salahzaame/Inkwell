import { KBD } from '../data.js';
import { docStats } from '../markdown.jsx';

export default function StatusBar({ doc, hasNote }) {
  const { words, sketches, tasks } = docStats(doc);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 14px', background: '#191b1f', borderTop: '1px solid #23252b', fontSize: '11.5px', color: '#5b6170', flexShrink: 0 }}>
      <div>
        {hasNote
          ? `${words} ${words === 1 ? 'word' : 'words'} · ${sketches} ${sketches === 1 ? 'sketch' : 'sketches'} · ${tasks} ${tasks === 1 ? 'task' : 'tasks'}`
          : 'no note open'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <span>{KBD} quick switcher</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
          saved · local vault
        </span>
      </div>
    </div>
  );
}
