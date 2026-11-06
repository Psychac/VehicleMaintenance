import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './design/fonts';
import { installTokens } from './design/tokens';
import './ui';
import './app.css';

installTokens();

const root = createRoot(document.getElementById('root')!);
if (import.meta.env.DEV && window.location.hash === '#gallery') {
  // Dev-only component gallery; tree-shaken from production builds.
  import('./ui/Gallery').then(({ default: Gallery }) => root.render(<Gallery />));
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
