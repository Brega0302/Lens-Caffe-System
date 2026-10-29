import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '../../test/utils';
import PaymentRegistry from './PaymentRegistry';

describe('PaymentRegistry Component', () => {
  it('renders payment registry and fetches payments', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ 
        success: true, 
        data: [
          { id: 1, full_name: 'John Doe', amount: 500, payment_date: '2023-10-01', payment_method: 'Cash', license_category: 'B' }
        ] 
      })
    }));

    renderWithProviders(<PaymentRegistry />);
    
    await waitFor(() => {
      expect(screen.getByText(/Global Payment Ledger/i)).toBeInTheDocument();
    });
  });
});
