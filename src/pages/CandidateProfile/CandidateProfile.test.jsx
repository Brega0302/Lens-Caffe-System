import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '../../test/utils';
import CandidateProfile from './CandidateProfile';
import * as ReactRouterDom from 'react-router-dom';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '1' }),
  };
});

describe('CandidateProfile Component', () => {
  beforeEach(() => {
    global.fetch = vi.fn((url) => {
      if (url.includes('/api/candidates/1')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              id: 1, full_name: 'Test Candidate', dob: '2000-01-01', personal_id_number: '123',
              address: 'Test Addr', phone_number: '1234', email: 't@t.com', license_category: 'B',
              status: 'In Progress', theory_test_passed: 0, practical_test_passed: 0, total_course_fee: 1000
            }
          })
        });
      }
      if (url.includes('/api/quattrodrive/payments')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) });
      }
      if (url.includes('/api/lessons')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: [] }) });
      }
      return Promise.reject(new Error('not found'));
    });
  });

  it('renders candidate details successfully', async () => {
    renderWithProviders(<CandidateProfile />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Candidate')).toBeInTheDocument();
      expect(screen.getByText('1000.00 BAM')).toBeInTheDocument();
    });
  });

  it('allows entering edit mode', async () => {
    renderWithProviders(<CandidateProfile />);
    
    await waitFor(() => {
      expect(screen.getByText('Test Candidate')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Edit Profile/i }));
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeInTheDocument();
  });
});
