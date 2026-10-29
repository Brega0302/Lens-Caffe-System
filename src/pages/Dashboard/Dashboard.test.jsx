import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '../../test/utils';
import Dashboard from './Dashboard';

describe('Dashboard Component', () => {
  it('renders dashboard with fetching data', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ 
        success: true, 
        data: { 
          total_active_candidates: 10,
          total_b_category: 5,
          total_revenue: 1000,
          schedule: [],
          alerts: []
        } 
      })
    }));

    renderWithProviders(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });
  });
});
