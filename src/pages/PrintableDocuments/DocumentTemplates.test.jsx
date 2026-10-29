import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Prilog3, Prilog4, Prilog5 } from './DocumentTemplates';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

describe('DocumentTemplates Components', () => {
  const mockCandidateData = {
    success: true,
    data: {
      id: 1,
      full_name: 'John Doe',
      dob: '2000-01-01',
      address: 'Test Addr',
      license_category: 'B',
      theory_test_passed: 1,
      practical_test_passed: 0
    }
  };

  it('renders Prilog3 with candidate data', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockCandidateData)
    }));

    render(
      <MemoryRouter initialEntries={['/print/prilog3/1']}>
        <Routes>
          <Route path="/print/prilog3/:id" element={<Prilog3 />} />
        </Routes>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    });
  });

  it('renders Prilog4 with candidate data', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockCandidateData)
    }));

    render(
      <MemoryRouter initialEntries={['/print/prilog4/1']}>
        <Routes>
          <Route path="/print/prilog4/:id" element={<Prilog4 />} />
        </Routes>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    });
  });

  it('renders Prilog5 with candidate data', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockCandidateData)
    }));

    render(
      <MemoryRouter initialEntries={['/print/prilog5/1']}>
        <Routes>
          <Route path="/print/prilog5/:id" element={<Prilog5 />} />
        </Routes>
      </MemoryRouter>
    );
    
    await waitFor(() => {
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    });
  });
});
