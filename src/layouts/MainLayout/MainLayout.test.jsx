import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '../../test/utils';
import MainLayout from './MainLayout';
import * as AuthContext from '../../contexts/useAuth';

describe('MainLayout Component', () => {
  beforeEach(() => {
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { username: 'admin' },
      logout: vi.fn()
    });
  });

  it('renders sidebar navigation correctly', () => {
    renderWithProviders(<MainLayout />);
    
    expect(screen.getByText(/Quattro/i)).toBeInTheDocument();
    expect(screen.getByText(/Candidates/i)).toBeInTheDocument();
    expect(screen.getByText(/Payments/i)).toBeInTheDocument();
  });

  it('logs out user when logout button is clicked', async () => {
    const mockLogout = vi.fn();
    vi.spyOn(AuthContext, 'useAuth').mockReturnValue({
      user: { username: 'admin' },
      logout: mockLogout
    });

    renderWithProviders(<MainLayout />);
    
    const logoutBtn = screen.getByText(/Logout/i);
    fireEvent.click(logoutBtn);

    expect(mockLogout).toHaveBeenCalled();
  });
});
