import { ACCENTS } from '../data.js';

function Toggle({ on }) {
  return (
    <span style={{ width: '34px', height: '20px', borderRadius: '99px', background: on ? 'var(--acc)' : '#2c2f37', position: 'relative', flexShrink: 0, transition: 'background .15s' }}>
      <span style={{ position: 'absolute', top: '2px', left: on ? '16px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: on ? '#17181c' : '#8b90a0', transition: 'left .15s' }} />
    </span>
  );
}

function Row({ title, sub, right, onClick, last }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '11px 0', borderBottom: last ? 'none' : '1px solid #26292f', cursor: onClick ? 'pointer' : 'default' }}>
      <div>
        <div style={{ fontSize: '13.5px', fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: '12px', color: '#8b90a0' }}>{sub}</div>
      </div>
      {right}
    </div>
  );
}

const SECTION = { fontSize: '11px', fontWeight: 600, letterSpacing: '.5px', textTransform: 'uppercase', color: '#5b6170', margin: '18px 0 2px' };

export default function SettingsModal({ settings, setSettings, theme, setTheme, vault, onClose }) {
  const tog = (k) => () => setSettings(s => ({ ...s, [k]: !s[k] }));

  const exportVault = () => {
    const blob = new Blob([JSON.stringify({ ...vault, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'inkwell-vault.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importVault = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    file.text().then(text => {
      const data = JSON.parse(text);
      if (!Array.isArray(data.files) || typeof data.docs !== 'object') throw new Error('not a vault file');
      if (!window.confirm('Replace the current vault with the imported one? This overwrites your notes on this device.')) return;
      localStorage.setItem('inkwell:v3', JSON.stringify({
        files: data.files, docs: data.docs, sketches: data.sketches ?? {}, settings: data.settings, theme: data.theme,
      }));
      window.location.reload();
    }).catch(() => window.alert('That file doesn\'t look like an Inkwell vault export.'));
  };

  const actionBtn = {
    flex: 1, textAlign: 'center', fontSize: '12.5px', color: '#8b90a0', border: '1px solid #2c2f37',
    borderRadius: '8px', padding: '8px', cursor: 'pointer',
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(10,11,13,.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '460px', background: '#1e2025', border: '1px solid #2c2f37', borderRadius: '14px', boxShadow: '0 24px 60px rgba(0,0,0,.5)', padding: '22px 24px', animation: 'popIn .12s ease-out' }}>
        <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '2px' }}>Settings</div>
        <div style={{ fontSize: '12.5px', color: '#8b90a0', marginBottom: '18px' }}>Inkwell vault · v0.1</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Row title="Local assistant" sub="Prefer Ollama (localhost:11434) over the free cloud model" right={<Toggle on={settings.localAi} />} onClick={tog('localAi')} />
          <Row title="Sync" sub="End-to-end encrypted, for sharing with friends" right={<Toggle on={settings.sync} />} onClick={tog('sync')} />
          <Row title="Spellcheck" sub="Underline unknown words while writing" right={<Toggle on={settings.spell} />} onClick={tog('spell')} />
          <Row title="Vim keybindings" sub="For the brave" right={<Toggle on={settings.vim} />} onClick={tog('vim')} last />

          <div style={SECTION}>Assistant providers</div>
          <div style={{ padding: '11px 0', borderBottom: '1px solid #26292f' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 500 }}>OpenRouter API key</div>
            <div style={{ fontSize: '12px', color: '#8b90a0', marginBottom: '8px' }}>
              Free key from <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: 'var(--acc)' }}>openrouter.ai/keys</a> — used for chat and deck design (model: {settings.openrouterModel || 'openai/gpt-oss-20b:free'}). Stays in this browser.
            </div>
            <input
              type="password"
              value={settings.openrouterKey || ''}
              onChange={(e) => setSettings(s => ({ ...s, openrouterKey: e.target.value.trim() }))}
              placeholder="sk-or-…"
              spellCheck={false}
              style={{ width: '100%', background: '#16181d', border: '1px solid #2c2f37', borderRadius: '8px', padding: '8px 10px', color: '#dadde5', fontSize: '12.5px', outline: 'none' }}
            />
          </div>

          <div style={SECTION}>Appearance</div>
          <Row
            title="Accent color" sub="Links, tags and highlights"
            right={(
              <div style={{ display: 'flex', gap: '8px' }}>
                {ACCENTS.map(hex => (
                  <span
                    key={hex}
                    onClick={() => setTheme(t => ({ ...t, accent: hex }))}
                    style={{ width: '18px', height: '18px', borderRadius: '50%', background: hex, cursor: 'pointer', outline: theme.accent === hex ? '2px solid ' + hex : 'none', outlineOffset: '2px' }}
                  />
                ))}
              </div>
            )}
          />
          <Row title="Paper page" sub="Notes on a warm paper sheet — Inkwell's signature look" right={<Toggle on={!!theme.paper} />} onClick={() => setTheme(t => ({ ...t, paper: !t.paper }))} />
          <Row title="Canvas grid" sub="Show a grid in sketch blocks" last right={<Toggle on={!!theme.grid} />} onClick={() => setTheme(t => ({ ...t, grid: !t.grid }))} />
        </div>
        <div style={SECTION}>Vault</div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <div className="hv-chip" onClick={exportVault} style={actionBtn}>⬇ Export vault (.json)</div>
          <label className="hv-chip" style={actionBtn}>
            ⬆ Import vault…
            <input type="file" accept=".json,application/json" onChange={importVault} style={{ display: 'none' }} />
          </label>
        </div>
        <div style={{ fontSize: '11px', color: '#5b6170', marginTop: '8px' }}>
          Notes live in this browser's storage — export regularly, or before switching devices.
        </div>
        <div className="hv-btn" onClick={onClose} style={{ marginTop: '20px', textAlign: 'center', background: '#26292f', borderRadius: '8px', padding: '9px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Done</div>
      </div>
    </div>
  );
}
