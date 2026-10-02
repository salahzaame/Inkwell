// A browser-like global environment so TipTap's editor can run under node --test.
import { Window } from 'happy-dom';

const win = new Window();
for (const key of ['window', 'document', 'navigator', 'Node', 'HTMLElement', 'Element', 'DocumentFragment',
  'MutationObserver', 'getComputedStyle', 'DOMParser', 'Text', 'KeyboardEvent', 'Event', 'CustomEvent']) {
  if (globalThis[key] === undefined) globalThis[key] = win[key];
}
