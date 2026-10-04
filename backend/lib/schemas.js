import { z } from 'zod';

/**
 * Task Schema
 */
export const TaskItemSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  description: z.string().default(''),
  suggestedAssignee: z.string().nullable().default(null),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  status: z.enum(['pending', 'in_progress', 'done']).default('pending'),
  category: z.string().optional()
});

export const TaskListSchema = z.array(TaskItemSchema);

/**
 * Source Schema
 */
export const ResearchSourceSchema = z.object({
  title: z.string().default('Web Source'),
  url: z.string().url().or(z.string()),
  domain: z.string().default(''),
  snippet: z.string().default(''),
  key_findings: z.array(z.string()).default([])
});

/**
 * Research Result Schema
 */
export const ResearchResultSchema = z.object({
  query: z.string().default(''),
  researchUsed: z.boolean().default(false),
  sources: z.array(ResearchSourceSchema).default([]),
  competitors: z.array(z.any()).default([]),
  market_signals: z.array(z.string()).default([]),
  pricing_signals: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([])
});

/**
 * Enterprise BRD Schema (29 Sections)
 */
export const BRDSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  summary: z.string().min(1, 'Summary is required'),
  content: z.string().min(10, 'BRD content must have descriptive text'),
  requirements: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    actor: z.string().optional(),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    expectedOutcome: z.string().optional()
  })).default([]),
  risks: z.array(z.string()).default([]),
  kpis: z.array(z.string()).default([]),
  openQuestions: z.array(z.string()).default([]),
  sources: z.array(ResearchSourceSchema).default([]),
  metadata: z.object({
    researchUsed: z.boolean().default(false),
    confidence: z.enum(['high', 'medium', 'low']).default('high'),
    missingInformation: z.array(z.string()).default([]),
    evidenceClassification: z.object({
      userProvided: z.array(z.string()).default([]),
      liveResearch: z.array(z.string()).default([]),
      inferences: z.array(z.string()).default([]),
      assumptions: z.array(z.string()).default([])
    }).default({
      userProvided: [],
      liveResearch: [],
      inferences: [],
      assumptions: []
    })
  }).default({
    researchUsed: false,
    confidence: 'high',
    missingInformation: []
  })
});

/**
 * PRD Schema
 */
export const PRDSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  summary: z.string().min(1, 'Summary is required'),
  content: z.string().min(10, 'Content is required'),
  features: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    priority: z.enum(['P0', 'P1', 'P2']).default('P1')
  })).default([]),
  technicalSpecs: z.array(z.string()).default([]),
  metrics: z.array(z.string()).default([])
});

/**
 * Intent Schema
 */
export const IntentSchema = z.object({
  intent: z.string(),
  agent: z.string(),
  needsWebResearch: z.boolean().default(false),
  language: z.string().default('hi-IN'),
  confidence: z.number().min(0).max(1).default(1.0)
});
