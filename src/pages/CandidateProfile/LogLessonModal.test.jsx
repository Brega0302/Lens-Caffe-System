import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '../../test/utils';
import LogLessonModal from './LogLessonModal';

describe('LogLessonModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnLessonLogged = vi.fn();

  it('renders the lesson form correctly', () => {
    renderWithProviders(
      <LogLessonModal 
        isOpen={true} 
        onClose={mockOnClose} 
        onLessonLogged={mockOnLessonLogged} 
        candidateId={1} 
        candidateCategory="B" 
      />
    );
    
    expect(screen.getByRole('heading', { name: /Log Driving Lesson/i })).toBeInTheDocument();
    expect(screen.getByText(/Instructor Name/i)).toBeInTheDocument();
  });

  it('closes when cancel is clicked', () => {
    renderWithProviders(
      <LogLessonModal 
        isOpen={true} 
        onClose={mockOnClose} 
        onLessonLogged={mockOnLessonLogged} 
        candidateId={1} 
        candidateCategory="B" 
      />
    );
    
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
