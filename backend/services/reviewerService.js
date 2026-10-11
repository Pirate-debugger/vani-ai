/**
 * Reviewer & Critic Engine for Vani AI
 * Audits requirements documents for completeness, consistency, feasibility,
 * and India-market regulatory readiness.
 */

export function auditDocumentQuality(documentContent = '', metadata = {}) {
  const content = typeof documentContent === 'string' ? documentContent : '';
  const lower = content.toLowerCase();

  const checks = {
    hasExecutiveSummary: lower.includes('executive summary'),
    hasProblemStatement: lower.includes('problem statement') || lower.includes('problem'),
    hasProposedSolution: lower.includes('proposed solution') || lower.includes('solution'),
    hasFunctionalRequirements: lower.includes('functional requirement') || lower.includes('fr-001'),
    hasNonFunctionalRequirements: lower.includes('non-functional requirement') || lower.includes('nfr-001'),
    hasKPIs: lower.includes('kpi') || lower.includes('metrics') || lower.includes('success criteria'),
    hasCompetitors: lower.includes('competitor') || lower.includes('competition'),
    hasIndianContext: lower.includes('india') || lower.includes('inr') || lower.includes('₹') || lower.includes('upi') || lower.includes('gst'),
    hasRisksMitigation: lower.includes('risk') && lower.includes('mitigation'),
    hasSourcesOrResearch: Boolean(metadata.researchUsed || lower.includes('sources') || metadata.sources?.length > 0)
  };

  // 1. Completeness Score (max 40 pts)
  let completenessScore = 0;
  if (checks.hasExecutiveSummary) completenessScore += 4;
  if (checks.hasProblemStatement) completenessScore += 6;
  if (checks.hasProposedSolution) completenessScore += 6;
  if (checks.hasFunctionalRequirements) completenessScore += 8;
  if (checks.hasNonFunctionalRequirements) completenessScore += 6;
  if (checks.hasKPIs) completenessScore += 5;
  if (checks.hasCompetitors) completenessScore += 5;

  // 2. Consistency & Depth Score (max 30 pts)
  let consistencyScore = 15;
  // Check if FR requirements have structured markers
  const frCount = (content.match(/FR-\d{3}/g) || []).length;
  if (frCount >= 5) consistencyScore += 10;
  else if (frCount >= 2) consistencyScore += 5;

  const nfrCount = (content.match(/NFR-\d{3}/g) || []).length;
  if (nfrCount >= 3) consistencyScore += 5;

  // 3. Evidence & Feasibility (max 15 pts)
  let evidenceScore = 5;
  if (checks.hasSourcesOrResearch) evidenceScore += 10;
  else if (checks.hasRisksMitigation) evidenceScore += 5;

  // 4. India Context Readiness (max 15 pts)
  let indiaContextScore = 5;
  if (checks.hasIndianContext) indiaContextScore += 10;

  const totalScore = Math.min(100, completenessScore + consistencyScore + evidenceScore + indiaContextScore);

  // Generate actionable fix suggestions
  const suggestions = [];

  if (!checks.hasFunctionalRequirements || frCount < 4) {
    suggestions.push({
      priority: 'high',
      area: 'Functional Requirements',
      message: 'Expand functional requirements to at least FR-001 through FR-006 with clear Actor, Priority, and Expected Outcome.'
    });
  }

  if (!checks.hasNonFunctionalRequirements || nfrCount < 2) {
    suggestions.push({
      priority: 'high',
      area: 'Non-Functional Requirements',
      message: 'Add explicit security (authentication, DPDP Act), performance (latency SLA), and scalability targets.'
    });
  }

  if (!checks.hasIndianContext) {
    suggestions.push({
      priority: 'medium',
      area: 'India Market Localization',
      message: 'Include Indian pricing considerations (INR/UPI AutoPay), GST tax implications, and tier-2/3 vernacular language accessibility.'
    });
  }

  if (!checks.hasKPIs) {
    suggestions.push({
      priority: 'medium',
      area: 'KPIs & Success Criteria',
      message: 'Define measurable metrics (CAC, LTV, Monthly Active Users, Day-30 Retention) to measure product success.'
    });
  }

  if (!checks.hasSourcesOrResearch) {
    suggestions.push({
      priority: 'low',
      area: 'Market Evidence',
      message: 'Run live competitor web research via TinyFish to cite verified competitor pricing and market benchmarks.'
    });
  }

  return {
    score: totalScore,
    grade: totalScore >= 90 ? 'A+' : totalScore >= 80 ? 'A' : totalScore >= 70 ? 'B' : totalScore >= 60 ? 'C' : 'Needs Improvement',
    checks,
    metrics: {
      completenessScore,
      consistencyScore,
      evidenceScore,
      indiaContextScore,
      functionalRequirementsCount: frCount,
      nonFunctionalRequirementsCount: nfrCount
    },
    suggestions
  };
}

export default {
  auditDocumentQuality
};
