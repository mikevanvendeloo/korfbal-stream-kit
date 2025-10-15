import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

import App from './app';

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(baseElement).toBeTruthy();
  });

  it('shows navigation with Sponsors link', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(screen.getByText('Korfbal Stream Kit')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Sponsors' }).length).toBeGreaterThan(0);
  });
});
