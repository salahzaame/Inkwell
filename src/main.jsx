import { StrictMode, Suspense, lazy, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import Landing from './components/Landing.jsx';
import './styles.css';

// The app (with its heavy Excalidraw bundle) is only loaded once you enter it,
// so the landing page stays fast. Routing is hash-based — no server config,
// works on any static host. The vault is opened alongside, and the app is
// handed it already loaded: it never reads storage itself.
const App = lazy(async () => {
  const [{ default: InkwellApp }, { openVault }] = await Promise.all([import('./App.jsx'), import('./data/index.js')]);
  const { store, vault } = await openVault();
  return { default: () => <InkwellApp store={store} initial={vault} /> };
});

const subscribe = (cb) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHash = () => window.location.hash;

function AppLoading() {
  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: '#2b2723', color: '#a89e91', fontFamily: "'Instrument Sans', system-ui, sans-serif", fontSize: '14px' }}>
      Opening Inkwell…
    </div>
  );
}

function Root() {
  const hash = useSyncExternalStore(subscribe, getHash);
  if (hash === '#app') {
    return <Suspense fallback={<AppLoading />}><App /></Suspense>;
  }
  return <Landing onEnter={() => { window.location.hash = 'app'; }} />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
