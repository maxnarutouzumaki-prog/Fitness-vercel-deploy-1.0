import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import { AppProvider } from './state/AppContext';
import { DataProvider } from './state/DataContext';
import { ToastProvider } from './state/ToastContext';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/training.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <AppProvider>
      <DataProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </DataProvider>
    </AppProvider>
  </StrictMode>,
);

registerServiceWorker();
