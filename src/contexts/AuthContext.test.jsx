import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';

const TestComponent = () => {
  const { user, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="user-status">{user ? `Logged in as ${user.username}` : 'Not logged in'}</span>
      <button onClick={() => login({ token: 'session-token', expiresAt: new Date(Date.now() + 60_000).toISOString(), user: { username: 'admin', role: 'OWNER' } })}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  it('provides authentication state and functions', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { username: 'admin' } })
      })
    );

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('user-status')).toHaveTextContent('Not logged in');

    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Logged in as admin');
    });

    fireEvent.click(screen.getByText('Logout'));
    
    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Not logged in');
    });
  });
});
