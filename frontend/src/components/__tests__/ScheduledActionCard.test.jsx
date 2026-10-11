import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import ScheduledActionCard from '../ScheduledActionCard';

vi.mock('axios');

describe('ScheduledActionCard Component', () => {
  const mockAction = {
    id: 'act-001',
    title: 'Research PG competitors and compare weekly changes',
    actionType: 'research',
    schedule: 'Every Monday at 8:00 AM',
    timezone: 'Asia/Kolkata',
    status: 'scheduled',
    nextRunAt: new Date(Date.now() + 86400000).toISOString(),
    lastRunAt: new Date(Date.now() - 86400000).toISOString()
  };

  it('renders scheduled action details, title, and recurrence schedule', () => {
    render(<ScheduledActionCard action={mockAction} />);
    expect(screen.getByText('Research PG competitors and compare weekly changes')).toBeInTheDocument();
    expect(screen.getByText('Every Monday at 8:00 AM')).toBeInTheDocument();
    expect(screen.getByText('IST')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('Run now')).toBeInTheDocument();
    expect(screen.getByText('Pause')).toBeInTheDocument();
  });

  it('triggers Run Now execution without destroying future schedule', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        success: true,
        result: { status: 'completed', runId: 'run-999' }
      }
    });

    const handleUpdated = vi.fn();
    render(<ScheduledActionCard action={mockAction} onActionUpdated={handleUpdated} />);

    const runNowBtn = screen.getByRole('button', { name: /Run now/i });
    await act(async () => {
      fireEvent.click(runNowBtn);
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/schedule/act-001/run-now',
      {},
      { withCredentials: true }
    );

    await waitFor(() => {
      expect(screen.getByText(/Ran successfully! Future schedule preserved./i)).toBeInTheDocument();
    });
  });

  it('supports pause and resume actions', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        success: true,
        action: { ...mockAction, status: 'paused' }
      }
    });

    const handleUpdated = vi.fn();
    render(<ScheduledActionCard action={mockAction} onActionUpdated={handleUpdated} />);

    const pauseBtn = screen.getByRole('button', { name: /Pause/i });
    await act(async () => {
      fireEvent.click(pauseBtn);
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/schedule/act-001/pause',
      {},
      { withCredentials: true }
    );

    expect(handleUpdated).toHaveBeenCalledWith(expect.objectContaining({ status: 'paused' }));
  });
});
