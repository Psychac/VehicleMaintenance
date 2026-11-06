import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installTokens } from './design/tokens';
import './styles.css';

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
