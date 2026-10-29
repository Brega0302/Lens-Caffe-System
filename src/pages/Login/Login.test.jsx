import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '../../test/utils';
import Login from './Login';
import * as AuthContext from '../../contexts/useAuth';

describe('Login Component', () => {
  it('renders login form', () => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: null, login: vi.fn() });
    renderWithProviders(<Login />);
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
  });

  it('submits login form', async () => {
    const mockLogin = vi.fn();
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ user: null, login: mockLogin });
    
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, user: { username: 'admin' } })
    }));

    renderWithProviders(<Login />);
    
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password' } });
    fireEvent.click(screen.getByText(/Sign In/i));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
  });
});
