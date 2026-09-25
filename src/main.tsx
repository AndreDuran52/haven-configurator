import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.tsx';
import { offerUpdate } from './state/update';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Precache-only service worker (plan §3): prompt to update, never auto-reload.
if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    onNeedRefresh: () => offerUpdate(() => void updateSW(true)),
  });
}
