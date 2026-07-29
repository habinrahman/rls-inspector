import { describe, expect, it } from 'vitest';
import {
  detectIssues,
  extractColumnsFromCondition,
  testPolicyCondition,
} from './analysis.js';

describe('detectIssues', () => {
  it('returns empty buckets for no policies', () => {
    expect(detectIssues([], 'posts')).toEqual({
      issues: [],
      warnings: [],
      suggestions: [],
    });
  });

  it('flags INSERT missing WITH CHECK as critical', () => {
    const { issues } = detectIssues(
      [{ policyname: 'insert_own', cmd: 'INSERT', qual: 'true', with_check: null }],
      'posts',
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toBe('INSERT policy missing WITH CHECK');
    expect(issues[0].suggestion).toContain('ALTER POLICY "insert_own" ON "posts"');
    expect(issues[0].suggestion).toContain('auth.uid() = user_id');
  });

  it('flags UPDATE missing WITH CHECK', () => {
    const { issues } = detectIssues(
      [{ policyname: 'update_own', cmd: 'UPDATE', qual: '(auth.uid() = user_id)', with_check: null }],
      'posts',
    );
    expect(issues[0].title).toBe('UPDATE policy missing WITH CHECK');
    expect(issues[0].suggestion).toContain('WITH CHECK ((auth.uid() = user_id))');
  });

  it('quotes identifiers with spaces in fix SQL', () => {
    const { issues } = detectIssues(
      [{ policyname: 'Anyone can update', cmd: 'UPDATE', qual: 'true', with_check: null }],
      'My Table',
    );
    expect(issues[0].suggestion).toContain('ALTER POLICY "Anyone can update" ON "My Table"');
  });

  it('warns on USING true policies', () => {
    const { warnings } = detectIssues(
      [{ policyname: 'open', cmd: 'SELECT', qual: 'true', with_check: null }],
      'posts',
    );
    expect(warnings.some((w) => w.includes('allows SELECT for everyone'))).toBe(true);
  });

  it('warns when INSERT/UPDATE exist but SELECT does not', () => {
    const { warnings } = detectIssues(
      [
        { policyname: 'ins', cmd: 'INSERT', qual: '(auth.uid() = user_id)', with_check: '(auth.uid() = user_id)' },
      ],
      'posts',
    );
    expect(warnings.some((w) => w.includes('No SELECT policies found'))).toBe(true);
  });

  it('warns on complex USING clauses', () => {
    const { warnings } = detectIssues(
      [{ policyname: 'fn', cmd: 'SELECT', qual: 'my_function(x)', with_check: null }],
      'posts',
    );
    expect(warnings.some((w) => w.includes('complex operations'))).toBe(true);
  });

  it('warns on auth.role() usage', () => {
    const { warnings } = detectIssues(
      [{ policyname: 'role', cmd: 'SELECT', qual: 'auth.role() = admin', with_check: null }],
      'posts',
    );
    expect(warnings.some((w) => w.includes('auth.role()'))).toBe(true);
  });

  it('warns when non-SELECT policy lacks auth context', () => {
    const { warnings } = detectIssues(
      [{ policyname: 'bad', cmd: 'DELETE', qual: 'status = archived', with_check: null }],
      'posts',
    );
    expect(warnings.some((w) => w.includes("doesn't use auth context"))).toBe(true);
  });

  it('always emits four best-practice suggestions', () => {
    const { suggestions } = detectIssues(
      [{ policyname: 'ok', cmd: 'SELECT', qual: '(auth.uid() = user_id)', with_check: null }],
      'posts',
    );
    expect(suggestions).toHaveLength(4);
    expect(suggestions.map((s) => s.title)).toEqual([
      'Test with different user roles',
      'Monitor policy rejections',
      'Document your policies',
      'Regular security audit',
    ]);
  });
});

describe('testPolicyCondition', () => {
  it('returns true for USING true', () => {
    expect(testPolicyCondition('true', 'uuid-1', 'admin')).toBe(true);
  });

  it('returns false for empty condition', () => {
    expect(testPolicyCondition('', 'uuid-1', 'admin')).toBe(false);
  });
});

describe('extractColumnsFromCondition', () => {
  it('extracts column names from comparisons', () => {
    expect(extractColumnsFromCondition('user_id = auth.uid() AND status != deleted')).toEqual([
      'user_id',
      'status',
    ]);
  });

  it('returns empty array for null condition', () => {
    expect(extractColumnsFromCondition(null)).toEqual([]);
  });
});
