import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import StatusPage from './StatusPage';
import './styles.css';

// Dark mode follows the device, as the kit does before anyone chooses
const dark = window.matchMedia?.('(prefers-color-scheme: dark)');
const applyTheme = () => document.documentElement.classList.toggle('dark', !!dark?.matches);
applyTheme();
dark?.addEventListener?.('change', applyTheme);

const queryClient = new QueryClient();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <StatusPage/>
    </QueryClientProvider>
  </StrictMode>,
);
