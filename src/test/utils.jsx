import React from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';

export const renderWithProviders = (ui, { route = '/' } = {}) => {
  window.history.pushState({}, 'Test page', route);

  return render(
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          {ui}
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  );
};
