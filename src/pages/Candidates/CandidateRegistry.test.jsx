import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '../../test/utils';
import CandidateRegistry from './CandidateRegistry';

describe('CandidateRegistry Component', () => {
  beforeEach(() => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/api/candidates')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: [
              {
                id: 1, full_name: 'Test Candidate', dob: '2000-01-01', personal_id_number: '123',
                address: 'Test Addr', phone_number: '1234', email: 't@t.com', license_category: 'B',
                status: 'In Progress', theory_test_passed: 0, practical_test_passed: 0, total_course_fee: 1000
              }
            ]
          })
        });
      }
      return Promise.reject(new Error('not found'));
    });
  });

  it('renders candidate registry successfully', async () => {
    renderWithProviders(<CandidateRegistry />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Candidate')).toBeInTheDocument();
      expect(screen.getByText('123')).toBeInTheDocument();
    });
  });

  it('filters candidates by search term', async () => {
    renderWithProviders(<CandidateRegistry />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Candidate')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search/i);
    fireEvent.change(searchInput, { target: { value: 'Nonexistent' } });

    expect(screen.queryByText('Test Candidate')).not.toBeInTheDocument();
  });
});
