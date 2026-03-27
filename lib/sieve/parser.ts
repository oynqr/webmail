import type { FilterRule, FilterMetadata, VacationSieveConfig } from '@/lib/jmap/sieve-types';
import { debug } from '@/lib/debug';

export interface ParseResult {
  rules: FilterRule[];
  isOpaque: boolean;
  vacation?: VacationSieveConfig;
}

const OPAQUE: ParseResult = { rules: [], isOpaque: true };

const METADATA_BEGIN = '/* @metadata:begin';
const METADATA_END = '@metadata:end */';

function isValidCondition(c: unknown): boolean {
  if (!c || typeof c !== 'object') return false;
  const cond = c as Record<string, unknown>;
  return typeof cond.field === 'string' && typeof cond.comparator === 'string' && typeof cond.value === 'string';
}

function isValidAction(a: unknown): boolean {
  if (!a || typeof a !== 'object') return false;
  const act = a as Record<string, unknown>;
  return typeof act.type === 'string';
}

function isValidRule(rule: unknown): rule is FilterRule {
  if (!rule || typeof rule !== 'object') return false;
  const r = rule as Record<string, unknown>;
  if (
    typeof r.id !== 'string' ||
    typeof r.name !== 'string' ||
    typeof r.enabled !== 'boolean' ||
    (r.matchType !== 'all' && r.matchType !== 'any') ||
    !Array.isArray(r.conditions) ||
    !Array.isArray(r.actions) ||
    typeof r.stopProcessing !== 'boolean'
  ) return false;

  return r.conditions.every(isValidCondition) && r.actions.every(isValidAction);
}

/**
 * Detect Stalwart-generated vacation-only scripts (no metadata).
 * These contain `vacation` command but no other filter logic we need to preserve.
 */
function detectVacationOnlyScript(content: string): ParseResult | null {
  // Must contain a vacation command
  if (!/\bvacation\b/.test(content)) return null;

  // Strip requires, comments, and whitespace to see if only vacation remains
  const stripped = content
    .replace(/^\s*require\s+\[[^\]]*\]\s*;/gm, '')
    .replace(/#[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();

  // After stripping, the only meaningful statement should be a vacation command.
  // Check there are no if/elsif/else blocks (i.e., no filter rules).
  if (/\b(?:if|elsif|else)\b/.test(stripped)) return null;

  // Extract subject if present
  const subjectMatch = stripped.match(/:subject\s+"((?:[^"\\]|\\.)*)"/); 
  const subject = subjectMatch ? subjectMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') : '';

  // Extract the body text (last quoted string in the vacation command)
  // Stalwart uses MIME format; extract the plain text after the MIME headers
  const mimeBodyMatch = stripped.match(/Content-Transfer-Encoding:[^\n]*\n\n([\s\S]*?)"\s*;\s*$/);
  const simpleBodyMatch = stripped.match(/vacation[^;]*"((?:[^"\\]|\\.)*)"\s*;\s*$/);
  let textBody = '';
  if (mimeBodyMatch) {
    textBody = mimeBodyMatch[1].trim();
  } else if (simpleBodyMatch) {
    textBody = simpleBodyMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  return {
    rules: [],
    isOpaque: false,
    vacation: { isEnabled: true, subject, textBody },
  };
}

export function parseScript(content: string): ParseResult {
  const beginIdx = content.indexOf(METADATA_BEGIN);
  if (beginIdx === -1) {
    // No metadata — check if it's a Stalwart vacation-only script
    return detectVacationOnlyScript(content) || OPAQUE;
  }

  const endIdx = content.indexOf(METADATA_END, beginIdx);
  if (endIdx === -1) return OPAQUE;

  const jsonStart = beginIdx + METADATA_BEGIN.length;
  const jsonStr = content.slice(jsonStart, endIdx).trim();

  let metadata: FilterMetadata;
  try {
    metadata = JSON.parse(jsonStr);
  } catch (e) {
    debug.warn('Failed to parse Sieve metadata JSON:', e);
    return OPAQUE;
  }

  if (!metadata || metadata.version !== 1) return OPAQUE;
  if (!Array.isArray(metadata.rules)) return OPAQUE;

  for (const rule of metadata.rules) {
    if (!isValidRule(rule)) return OPAQUE;
  }

  return { rules: metadata.rules, isOpaque: false, vacation: metadata.vacation };
}
