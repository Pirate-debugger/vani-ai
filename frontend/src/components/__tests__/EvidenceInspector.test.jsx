import React, { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EvidenceInspector from '../EvidenceInspector';

describe('EvidenceInspector Component', () => {
  const mockClaims = [
    {
      claim: 'Top competitors require a 2-month security deposit in Delhi NCR',
      evidence: 'ZoloStays and Stanza Living listings indicate 2 months upfront deposit requirement.',
      confidence: 'high'
    },
    {
      claim: 'Average occupancy rate across student PGs is 85%',
      evidence: 'Coliving industry reports 2025 estimate 85% occupancy during college admission cycles.',
      confidence: 'medium'
    }
  ];

  const mockSources = [
    { title: 'ZoloStays Pricing Guide', domain: 'zolostays.com', url: 'https://zolostays.com/pricing' }
  ];

  it('renders verified claims, statement, evidence quote, and confidence badge', () => {
    render(<EvidenceInspector claims={mockClaims} sources={mockSources} isOpen={true} onClose={() => {}} />);

    expect(screen.getByText('Evidence Inspector')).toBeInTheDocument();
    expect(screen.getByText(/2 Verified Claims/i)).toBeInTheDocument();
    expect(screen.getAllByText('Top competitors require a 2-month security deposit in Delhi NCR').length).toBeGreaterThan(0);
    expect(screen.getByText(/ZoloStays and Stanza Living listings indicate 2 months/i)).toBeInTheDocument();
    expect(screen.getByText(/High Confidence/i)).toBeInTheDocument();
  });

  it('allows clicking between different claims to inspect individual evidence', async () => {
    render(<EvidenceInspector claims={mockClaims} sources={mockSources} isOpen={true} onClose={() => {}} />);

    // Click claim 2
    const claim2Btn = screen.getByText('Average occupancy rate across student PGs is 85%');
    await act(async () => {
      fireEvent.click(claim2Btn);
    });

    expect(screen.getByText(/Coliving industry reports 2025 estimate 85% occupancy/i)).toBeInTheDocument();
    expect(screen.getByText(/Corroborated/i)).toBeInTheDocument();
  });
});
