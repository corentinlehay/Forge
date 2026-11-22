import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo/wdth.css';
import { App } from './app/App';
import './design/tokens.css';

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
