import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { installTokens } from './design/tokens';
import './styles.css';

installTokens();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
