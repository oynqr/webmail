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

export function parseScript(content: string): ParseResult {
  const beginIdx = content.indexOf(METADATA_BEGIN);
  if (beginIdx === -1) return OPAQUE;

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
