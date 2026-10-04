/**
 * Robust JSON Parser and Sanitizer for Structured AI Outputs
 * Handles fenced markdown, explanatory commentary before/after JSON,
 * trailing commas, unescaped newlines, and schema validation with repair.
 */

/**
 * Attempts to repair common JSON malformations:
 * - Trailing commas in arrays and objects
 * - Control characters / unescaped newlines within string literals
 * - Stray code block markers
 */
function attemptJsonRepair(jsonString) {
  let cleaned = jsonString.trim();

  // Strip code block fences if still present
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Replace trailing commas before closing braces or brackets: { "a": 1, } -> { "a": 1 }
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  // Replace undefined or NaN with null
  cleaned = cleaned.replace(/:\s*undefined\b/g, ': null');
  cleaned = cleaned.replace(/:\s*NaN\b/g, ': null');

  return cleaned;
}

/**
 * Extracts candidate JSON substring from text by matching the outer bounds of { ... } or [ ... ]
 */
function extractJsonSubstring(text) {
  if (typeof text !== 'string') return '';
  let str = text.trim();

  // If wrapped in markdown block, extract block content first
  const codeBlockMatch = str.match(/```(?:json)?([\s\S]*?)```/i);
  if (codeBlockMatch) {
    str = codeBlockMatch[1].trim();
  }

  const firstBrace = str.indexOf('{');
  const firstBracket = str.indexOf('[');

  // If starts with object or bracket comes later
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    const lastBrace = str.lastIndexOf('}');
    if (lastBrace !== -1 && lastBrace > firstBrace) {
      return str.substring(firstBrace, lastBrace + 1);
    }
  } else if (firstBracket !== -1) {
    const lastBracket = str.lastIndexOf(']');
    if (lastBracket !== -1 && lastBracket > firstBracket) {
      return str.substring(firstBracket, lastBracket + 1);
    }
  }

  return str;
}

/**
 * Sanitizes unescaped control characters inside string literals (e.g. raw newlines, carriage returns, tabs)
 */
export function sanitizeControlCharsInStrings(str) {
  if (typeof str !== 'string') return '';
  let result = '';
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (inString) {
      if (isEscaped) {
        result += char;
        isEscaped = false;
      } else if (char === '\\') {
        result += char;
        isEscaped = true;
      } else if (char === '"') {
        result += char;
        inString = false;
      } else if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else {
        const code = char.charCodeAt(0);
        if (code < 32) {
          result += '\\u' + code.toString(16).padStart(4, '0');
        } else {
          result += char;
        }
      }
    } else {
      if (char === '"') {
        inString = true;
      }
      result += char;
    }
  }

  if (inString) {
    result += '"';
  }

  return result;
}

/**
 * Attempts to close truncated JSON structures (missing closing quotes, brackets, braces)
 */
export function attemptCloseTruncatedJson(str) {
  if (typeof str !== 'string') return '';
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (inString) {
      if (isEscaped) isEscaped = false;
      else if (char === '\\') isEscaped = true;
      else if (char === '"') inString = false;
    } else {
      if (char === '"') inString = true;
      else if (char === '{') openBraces++;
      else if (char === '}') openBraces = Math.max(0, openBraces - 1);
      else if (char === '[') openBrackets++;
      else if (char === ']') openBrackets = Math.max(0, openBrackets - 1);
    }
  }

  let closed = str.trim();
  if (inString) closed += '"';
  closed = closed.replace(/,\s*$/, '');
  while (openBrackets > 0) {
    closed += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    closed += '}';
    openBraces--;
  }
  return closed;
}

/**
 * parseStructuredJSON
 * Parses JSON with fallback strategies and minor repairs.
 *
 * @param {string} raw - raw LLM text output
 * @returns {any} parsed JavaScript object or array
 * @throws {Error} if parsing fails after all repair attempts
 */
export function parseStructuredJSON(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Invalid input: raw string required for JSON parsing');
  }

  const trimmed = raw.trim();

  // Attempt 1: Direct JSON.parse
  try {
    return JSON.parse(trimmed);
  } catch (err1) {
    // Continue to repair attempts
  }

  // Attempt 2: Extract JSON substring between braces/brackets
  const extracted = extractJsonSubstring(trimmed);
  try {
    return JSON.parse(extracted);
  } catch (err2) {
    // Continue to repair attempts
  }

  // Attempt 3: Repair trailing commas and common syntax slips on extracted text
  const repaired = attemptJsonRepair(extracted);
  try {
    return JSON.parse(repaired);
  } catch (err3) {
    // Continue to repair attempts
  }

  // Attempt 4: Sanitize unescaped control chars / newlines within string literals
  try {
    const sanitized = sanitizeControlCharsInStrings(repaired);
    return JSON.parse(sanitized);
  } catch (err4) {
    // Continue to repair attempts
  }

  // Attempt 5: Handle truncated JSON that was cut off mid-stream
  try {
    const closed = attemptCloseTruncatedJson(sanitizeControlCharsInStrings(repaired));
    return JSON.parse(closed);
  } catch (err5) {
    // Continue to repair attempts
  }

  // Attempt 6: Fix single quotes to double quotes if valid JSON keys are single quoted
  try {
    const singleQuoteFixed = repaired.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
    return JSON.parse(singleQuoteFixed);
  } catch (err6) {
    // Failed all attempts
  }

  const parseError = new Error(`Failed to parse structured JSON from AI output: ${raw.substring(0, 150)}...`);
  parseError.code = 'MALFORMED_AI_OUTPUT';
  throw parseError;
}

/**
 * Validates and normalizes BRD Document Schema
 * Target structure:
 * {
 *   "title": "string",
 *   "summary": "string",
 *   "content": "markdown string",
 *   "metadata": {
 *     "researchUsed": boolean,
 *     "confidence": "high" | "medium" | "low",
 *     "missingInformation": string[],
 *     "sources": any[]
 *   }
 * }
 */
export function validateAndNormalizeBRD(parsed, fallbackTitle = 'Business Requirements Document') {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('BRD must be a JSON object');
  }

  const title = (typeof parsed.title === 'string' && parsed.title.trim())
    ? parsed.title.trim()
    : fallbackTitle;

  let content = '';
  if (typeof parsed.content === 'string' && parsed.content.trim()) {
    content = parsed.content.trim();
  } else if (typeof parsed.body === 'string' && parsed.body.trim()) {
    content = parsed.body.trim();
  } else if (typeof parsed.description === 'string' && parsed.description.trim()) {
    content = parsed.description.trim();
  } else {
    // If content was structured as an object of sections
    const sections = Object.entries(parsed)
      .filter(([k]) => !['title', 'summary', 'metadata', 'sources'].includes(k))
      .map(([k, v]) => `## ${k.replace(/([A-Z])/g, ' $1').toUpperCase()}\n\n${typeof v === 'object' ? JSON.stringify(v, null, 2) : v}`)
      .join('\n\n');
    content = sections || '## 1. Executive Summary\n\nNo detailed content generated.';
  }

  let summary = '';
  if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
    summary = parsed.summary.trim();
  } else {
    // Generate a 1-2 sentence summary from content
    const firstLines = content.split('\n').filter(l => l.trim() && !l.startsWith('#')).slice(0, 2).join(' ');
    summary = firstLines.substring(0, 300) || `BRD for ${title}`;
  }

  const rawMetadata = parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : {};
  const metadata = {
    researchUsed: Boolean(rawMetadata.researchUsed || (parsed.sources && parsed.sources.length > 0)),
    confidence: ['high', 'medium', 'low'].includes(rawMetadata.confidence) ? rawMetadata.confidence : 'high',
    missingInformation: Array.isArray(rawMetadata.missingInformation) ? rawMetadata.missingInformation : [],
    sources: Array.isArray(rawMetadata.sources) ? rawMetadata.sources : (Array.isArray(parsed.sources) ? parsed.sources : [])
  };

  return {
    title,
    summary,
    content,
    metadata
  };
}

/**
 * Validates and normalizes task extraction array
 * Target schema:
 * [{ "title": "string", "description": "string", "suggestedAssignee": null, "priority": "high"|"medium"|"low" }]
 */
export function validateAndNormalizeTasks(parsed) {
  if (!Array.isArray(parsed)) {
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tasks)) {
      parsed = parsed.tasks;
    } else {
      return [];
    }
  }

  const seenTitles = new Set();
  const validTasks = [];

  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;

    const rawTitle = typeof item.title === 'string' ? item.title.trim() : '';
    if (!rawTitle) continue;

    const normalizedTitleKey = rawTitle.toLowerCase();
    if (seenTitles.has(normalizedTitleKey)) continue; // Deduplicate
    seenTitles.add(normalizedTitleKey);

    const rawPriority = typeof item.priority === 'string' ? item.priority.toLowerCase().trim() : 'medium';
    const priority = ['high', 'medium', 'low'].includes(rawPriority) ? rawPriority : 'medium';

    validTasks.push({
      title: rawTitle,
      description: typeof item.description === 'string' ? item.description.trim() : null,
      suggestedAssignee: typeof item.suggestedAssignee === 'string' ? item.suggestedAssignee.trim() : (typeof item.assignee === 'string' ? item.assignee.trim() : null),
      priority
    });
  }

  return validTasks;
}
