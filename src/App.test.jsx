import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import App from './App';

afterEach(() => { cleanup(); sessionStorage.clear(); });

describe('LensOS application', () => {
  it('shows sign in when there is no valid session', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /dobro došli/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/korisničko ime/i)).toBeInTheDocument();
  });

  it('opens the owner dashboard for a valid session', async () => {
    sessionStorage.setItem('lensos.token', 'test-token');
    sessionStorage.setItem('lensos.user', JSON.stringify({ username: 'owner', role: 'OWNER' }));
    sessionStorage.setItem('lensos.expiresAt', new Date(Date.now() + 60_000).toISOString());
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, data: { date: '2026-10-08', todayRevenue: '0.00', itemsSold: 0, inventoryItems: 0, lowStockCount: 0, outOfStockCount: 0, topProducts: [], lowStock: [], outOfStock: [] } }) });
    render(<App />);
    expect(await screen.findByRole('heading', { name: /dobar dan/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /magacin/i })).toBeInTheDocument();
  });
});
