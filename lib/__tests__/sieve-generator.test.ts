import { describe, it, expect } from 'vitest';
import { generateScript } from '@/lib/sieve/generator';
import { parseScript } from '@/lib/sieve/parser';
import type { FilterRule } from '@/lib/jmap/sieve-types';
import type { VacationSieveConfig } from '@/lib/jmap/sieve-types';

const makeRule = (overrides: Partial<FilterRule> = {}): FilterRule => ({
  id: 'rule-1',
  name: 'Test Rule',
  enabled: true,
  matchType: 'all',
  conditions: [{ field: 'subject', comparator: 'contains', value: 'Test' }],
  actions: [{ type: 'move', value: 'Archive' }],
  stopProcessing: false,
  ...overrides,
});

describe('sieve generator', () => {
  describe('fileinto with subfolder paths', () => {
    it('should generate correct fileinto for a root folder', () => {
      const rules = [makeRule({ actions: [{ type: 'move', value: 'Archive' }] })];
      const script = generateScript(rules);
      expect(script).toContain('fileinto "Archive";');
    });

    it('should generate correct fileinto for a subfolder path', () => {
      const rules = [makeRule({ actions: [{ type: 'move', value: 'Inbox/Test/Test2' }] })];
      const script = generateScript(rules);
      expect(script).toContain('fileinto "Inbox/Test/Test2";');
    });

    it('should preserve subfolder path in metadata round-trip', () => {
      const rules = [makeRule({ actions: [{ type: 'move', value: 'Inbox/Projects/Work' }] })];
      const script = generateScript(rules);
      const parsed = parseScript(script);
      expect(parsed.isOpaque).toBe(false);
      expect(parsed.rules[0].actions[0].value).toBe('Inbox/Projects/Work');
    });

    it('should generate correct fileinto :copy for a subfolder path', () => {
      const rules = [makeRule({ actions: [{ type: 'copy', value: 'Inbox/Backup/Important' }] })];
      const script = generateScript(rules);
      expect(script).toContain('fileinto :copy "Inbox/Backup/Important";');
    });

    it('should handle deeply nested subfolder paths', () => {
      const rules = [makeRule({ actions: [{ type: 'move', value: 'Inbox/A/B/C/D' }] })];
      const script = generateScript(rules);
      expect(script).toContain('fileinto "Inbox/A/B/C/D";');
    });
  });

  describe('require extensions', () => {
    it('should require fileinto for move actions', () => {
      const rules = [makeRule({ actions: [{ type: 'move', value: 'Test' }] })];
      const script = generateScript(rules);
      expect(script).toContain('require ["fileinto"]');
    });

    it('should require fileinto and copy for copy actions', () => {
      const rules = [makeRule({ actions: [{ type: 'copy', value: 'Test' }] })];
      const script = generateScript(rules);
      expect(script).toContain('"copy"');
      expect(script).toContain('"fileinto"');
    });
  });

  describe('conditions', () => {
    it('should generate header :contains for subject contains', () => {
      const rules = [makeRule({
        conditions: [{ field: 'subject', comparator: 'contains', value: 'hello' }],
      })];
      const script = generateScript(rules);
      expect(script).toContain('header :contains "Subject" "hello"');
    });

    it('should combine multiple conditions with allof', () => {
      const rules = [makeRule({
        matchType: 'all',
        conditions: [
          { field: 'from', comparator: 'contains', value: 'alice' },
          { field: 'subject', comparator: 'contains', value: 'urgent' },
        ],
      })];
      const script = generateScript(rules);
      expect(script).toContain('allof(');
    });

    it('should combine multiple conditions with anyof', () => {
      const rules = [makeRule({
        matchType: 'any',
        conditions: [
          { field: 'from', comparator: 'contains', value: 'alice' },
          { field: 'subject', comparator: 'contains', value: 'urgent' },
        ],
      })];
      const script = generateScript(rules);
      expect(script).toContain('anyof(');
    });
  });

  describe('disabled rules', () => {
    it('should not generate code for disabled rules', () => {
      const rules = [makeRule({ enabled: false })];
      const script = generateScript(rules);
      expect(script).not.toContain('fileinto');
      expect(script).not.toContain('if ');
    });
  });

  describe('stop processing', () => {
    it('should append stop when stopProcessing is true', () => {
      const rules = [makeRule({ stopProcessing: true })];
      const script = generateScript(rules);
      expect(script).toContain('stop;');
    });
  });

  describe('vacation support', () => {
    const vacation: VacationSieveConfig = {
      isEnabled: true,
      subject: 'Out of Office',
      textBody: 'I am currently away.',
    };

    it('should generate vacation block when vacation is enabled', () => {
      const script = generateScript([], vacation);
      expect(script).toContain('require ["vacation"]');
      expect(script).toContain('vacation :subject "Out of Office" "I am currently away.";');
    });

    it('should not generate vacation block when vacation is disabled', () => {
      const disabled: VacationSieveConfig = { isEnabled: false, subject: '', textBody: '' };
      const script = generateScript([], disabled);
      expect(script).not.toContain('vacation');
    });

    it('should generate vacation block without subject when subject is empty', () => {
      const noSubject: VacationSieveConfig = { isEnabled: true, subject: '', textBody: 'Away' };
      const script = generateScript([], noSubject);
      expect(script).toContain('vacation "Away";');
      expect(script).not.toContain(':subject');
    });

    it('should include both vacation and filter rules', () => {
      const rules = [makeRule()];
      const script = generateScript(rules, vacation);
      expect(script).toContain('"vacation"');
      expect(script).toContain('"fileinto"');
      expect(script).toContain('vacation :subject "Out of Office"');
      expect(script).toContain('fileinto "Archive"');
    });

    it('should preserve vacation settings in metadata round-trip', () => {
      const rules = [makeRule()];
      const script = generateScript(rules, vacation);
      const parsed = parseScript(script);
      expect(parsed.isOpaque).toBe(false);
      expect(parsed.vacation).toEqual(vacation);
      expect(parsed.rules).toHaveLength(1);
    });

    it('should escape special characters in vacation text', () => {
      const special: VacationSieveConfig = {
        isEnabled: true,
        subject: 'Re: "Test"',
        textBody: 'Line with "quotes" and \\backslash',
      };
      const script = generateScript([], special);
      expect(script).toContain(':subject "Re: \\"Test\\""');
      expect(script).toContain('"Line with \\"quotes\\" and \\\\backslash"');
    });
  });
});
