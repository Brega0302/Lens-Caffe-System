import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '../../test/utils';
import DocumentCenter from './DocumentCenter';

describe('DocumentCenter Component', () => {
  it('renders documents and candidates', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ 
        success: true, 
        data: [
          { id: 1, full_name: 'John Doe', status: 'In Progress', license_category: 'B', total_course_fee: 1000 }
        ] 
      })
    }));

    renderWithProviders(<DocumentCenter />);
    
    await waitFor(() => {
      expect(screen.getByText(/Document Center/i)).toBeInTheDocument();
    });
  });
});
