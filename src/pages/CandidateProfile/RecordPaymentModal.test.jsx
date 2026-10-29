import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '../../test/utils';
import RecordPaymentModal from './RecordPaymentModal';

describe('RecordPaymentModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnPaymentRecorded = vi.fn();

  it('renders the payment form correctly', () => {
    renderWithProviders(
      <RecordPaymentModal 
        isOpen={true} 
        onClose={mockOnClose} 
        onPaymentRecorded={mockOnPaymentRecorded} 
        candidateId={1} 
      />
    );
    
    expect(screen.getByRole('heading', { name: /Record Payment/i })).toBeInTheDocument();
    expect(screen.getByText(/Amount/i)).toBeInTheDocument();
  });

  it('closes when cancel is clicked', () => {
    renderWithProviders(
      <RecordPaymentModal 
        isOpen={true} 
        onClose={mockOnClose} 
        onPaymentRecorded={mockOnPaymentRecorded} 
        candidateId={1} 
      />
    );
    
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
