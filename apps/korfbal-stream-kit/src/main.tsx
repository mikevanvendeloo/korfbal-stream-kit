import {StrictMode} from 'react';
import {BrowserRouter} from 'react-router-dom';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import './styles.css';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {installOrganizationFetch} from './lib/organization';

// Every same-origin /api request gets the chosen organization (X-Organization), before anything fetches
installOrganizationFetch();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const queryClient = new QueryClient();

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
