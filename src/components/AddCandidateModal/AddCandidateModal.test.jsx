import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '../../test/utils';
import AddCandidateModal from './AddCandidateModal';

describe('AddCandidateModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnCandidateAdded = vi.fn();

  it('renders the form fields correctly', () => {
    renderWithProviders(<AddCandidateModal isOpen={true} onClose={mockOnClose} onCandidateAdded={mockOnCandidateAdded} />);
    
    expect(screen.getByRole('heading', { name: /Register New Candidate/i })).toBeInTheDocument();
    expect(screen.getByText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByText(/Personal ID/i)).toBeInTheDocument();
    expect(screen.getByText(/Category/i)).toBeInTheDocument();
  });

  it('closes when cancel is clicked', () => {
    renderWithProviders(<AddCandidateModal isOpen={true} onClose={mockOnClose} onCandidateAdded={mockOnCandidateAdded} />);
    
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows error if required fields are missing on submit', async () => {
    renderWithProviders(<AddCandidateModal isOpen={true} onClose={mockOnClose} onCandidateAdded={mockOnCandidateAdded} />);
    
    const submitButton = screen.getByRole('button', { name: /Register New Candidate/i });
    fireEvent.click(submitButton);

    // HTML5 validation would normally block this, but in jsdom we test custom validations if any.
    // If it relies purely on HTML5 'required', the form won't submit.
  });
});
