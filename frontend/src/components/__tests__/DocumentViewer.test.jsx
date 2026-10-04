import React, { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DocumentViewer from '../DocumentViewer';

describe('DocumentViewer Component', () => {
  const mockDoc = {
    id: 'doc-123',
    title: 'PG Finder Enterprise BRD',
    type: 'brd',
    content: `## 1. Executive Summary\nPG Finder is an AI-powered rental discovery platform.\n\n## 4. Business Objectives\n- Reduce vacancy rates by 30%\n\n## 12. Functional Requirements\n- **FR-001**: User Signup\n  - Actor: Student\n  - Priority: High\n  - Expected Outcome: Successful login\n\n## 13. Non-Functional Requirements\n- **NFR-001**: [Latency < 200ms]\n\n## 21. Risks & Mitigation\n- Data privacy breaches\n\n## 22. KPIs\n- 50,000 MAU in Q1`,
    metadata: {
      researchUsed: true,
      sources: [
        { title: 'ZoloStays Competitor Overview', domain: 'zolostays.com', url: 'https://zolostays.com' }
      ],
      evidence: [
        { claim: 'Competitors charge 1 month deposit', evidence: 'Market analysis of top 3 PG operators', source: 'zolostays.com', confidence: 'high' }
      ]
    },
    versions: [
      { id: 'ver-1', versionName: 'v1.0 Initial Draft', content: 'Initial draft content', createdAt: new Date().toISOString() },
      { id: 'ver-2', versionName: 'v1.1 Refined BRD', content: 'Refined content with tasks', createdAt: new Date().toISOString() }
    ]
  };

  it('renders document title and verified live research badge', () => {
    render(<DocumentViewer document={mockDoc} />);
    expect(screen.getByText('PG Finder Enterprise BRD')).toBeInTheDocument();
    expect(screen.getByText(/Live Research Verified/i)).toBeInTheDocument();
  });

  it('switches between Overview, Requirements, Research, Tasks, and Document tabs', async () => {
    render(<DocumentViewer document={mockDoc} />);

    // Click Requirements Tab
    const reqTab = screen.getByRole('button', { name: /Requirements/i });
    await act(async () => {
      fireEvent.click(reqTab);
    });
    expect(screen.getByText('FR-001')).toBeInTheDocument();

    // Click Research Tab
    const researchTab = screen.getByRole('button', { name: /^Research(\s*\(\d+\))?$/i });
    await act(async () => {
      fireEvent.click(researchTab);
    });
    expect(screen.getByText('ZoloStays Competitor Overview')).toBeInTheDocument();
    expect(screen.getByText(/Grounded Evidence & Claims/i)).toBeInTheDocument();
    expect(screen.getByText(/Competitors charge 1 month deposit/i)).toBeInTheDocument();
  });

  it('renders interactive Versions tab with snapshots and restore option', async () => {
    const handleRestore = vi.fn();
    render(<DocumentViewer document={mockDoc} onRestoreVersion={handleRestore} />);

    // Click Versions Tab
    const versionsTab = screen.getByRole('button', { name: /Versions/i });
    await act(async () => {
      fireEvent.click(versionsTab);
    });

    // Verify snapshot titles are shown
    expect(screen.getByText('v1.0 Initial Draft')).toBeInTheDocument();
    expect(screen.getByText('v1.1 Refined BRD')).toBeInTheDocument();

    // Click on a version to preview and verify restore button appears
    await act(async () => {
      fireEvent.click(screen.getByText('v1.0 Initial Draft'));
    });
    const restoreBtn = screen.getByRole('button', { name: /Restore This Version/i });
    expect(restoreBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(restoreBtn);
    });
    expect(handleRestore).toHaveBeenCalledWith(expect.objectContaining({ id: 'ver-1' }));
  });
});

