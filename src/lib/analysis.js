// src/lib/analysis.js

// Quote a Postgres identifier — wraps in double quotes and escapes any " inside.
// Required for policy/table names that contain spaces, mixed case, or reserved words.
const quoteIdent = (name) => `"${String(name).replace(/"/g, '""')}"`;

// Pick a sensible WITH CHECK condition for the fix suggestion.
// If the existing USING clause is just `true` (an open door), suggest the
// canonical row-ownership pattern instead so the fix actually fixes things.
const suggestedCheck = (qual) => {
  if (!qual || qual.trim().toLowerCase() === 'true') {
    return 'auth.uid() = user_id  /* replace with your business rule */';
  }
  return qual;
};

export function detectIssues(policies, tableName) {
  const issues = [];
  const warnings = [];
  const suggestions = [];

  if (!policies || policies.length === 0) {
    return { issues, warnings, suggestions };
  }

  const tableRef = tableName ? quoteIdent(tableName) : '<your_table>';

  // Check 1: Missing WITH CHECK on INSERT/UPDATE
  policies.forEach(policy => {
    if ((policy.cmd === 'INSERT' || policy.cmd === 'UPDATE') && !policy.with_check) {
      const policyRef = quoteIdent(policy.policyname);
      issues.push({
        title: `${policy.cmd} policy missing WITH CHECK`,
        description: `The policy "${policy.policyname}" allows ${policy.cmd.toLowerCase()} operations but doesn't have a WITH CHECK clause. This means users could ${policy.cmd.toLowerCase()} rows that should be restricted based on your business logic.`,
        suggestion: `Add a WITH CHECK clause to ensure data integrity:\nALTER POLICY ${policyRef} ON ${tableRef} WITH CHECK (${suggestedCheck(policy.qual)});`
      });
    }
  });

  // Check 2: Overly permissive policies
  policies.forEach(policy => {
    if (policy.qual === 'true' || policy.qual === 'TRUE') {
      warnings.push(
        `Policy "${policy.policyname}" allows ${policy.cmd} for everyone. Make sure this is intentional - anyone can ${policy.cmd.toLowerCase()} any row.`
      );
    }
  });

  // Check 3: Missing SELECT policies
  const hasSelect = policies.some(p => p.cmd === 'SELECT');
  const hasInsert = policies.some(p => p.cmd === 'INSERT');
  const hasUpdate = policies.some(p => p.cmd === 'UPDATE');

  if (!hasSelect && (hasInsert || hasUpdate)) {
    warnings.push(
      'No SELECT policies found. Users can INSERT/UPDATE data but might not be able to see what they created or modified.'
    );
  }

  // Check 4: Conditions using auth context
  policies.forEach(policy => {
    if (!policy.qual) return;

    const qual = policy.qual.toLowerCase();
    
    // Check for potential performance issues
    if (qual.includes('function') || qual.includes('array') || qual.includes('json')) {
      warnings.push(
        `Policy "${policy.policyname}" uses complex operations (functions/arrays/JSON). These can be slow on large tables. Consider using simple column comparisons instead.`
      );
    }

    // Check for role-based access without proper indexes
    if (qual.includes('auth.role()')) {
      warnings.push(
        `Policy "${policy.policyname}" uses auth.role(). Make sure your users table has an index on the role column for performance.`
      );
    }
  });

  // Check 5: Verify auth context is used
  policies.forEach(policy => {
    if (!policy.qual) return;

    const qual = policy.qual.toLowerCase();
    const usesAuthContext = qual.includes('auth.uid()') || 
                           qual.includes('auth.role()') || 
                           qual.includes('auth.email()') ||
                           qual.includes('current_user') ||
                           qual.includes('session_user');

    if (!usesAuthContext && policy.cmd !== 'SELECT' && policy.qual !== 'true') {
      warnings.push(
        `Policy "${policy.policyname}" doesn't use auth context (auth.uid(), auth.role(), etc). Without this, the policy won't differentiate between users.`
      );
    }
  });

  // Suggestions
  suggestions.push({
    title: 'Test with different user roles',
    description: 'Use this tool to test policies with different users. Policies behave differently based on each user\'s auth context and role.'
  });

  suggestions.push({
    title: 'Monitor policy rejections',
    description: 'Enable PostgreSQL logging to see which policies are rejecting queries in production. This helps catch security issues early.'
  });

  suggestions.push({
    title: 'Document your policies',
    description: 'Add comments to your RLS policies explaining the business logic. This helps future developers understand why each policy exists.'
  });

  suggestions.push({
    title: 'Regular security audit',
    description: 'Review your RLS policies quarterly. As your app grows, you might need more granular access controls.'
  });

  return { issues, warnings, suggestions };
}

// Helper function to test if a policy condition would match a user
export function testPolicyCondition(condition, userId, userRole) {
  // This is a simplified version - in production you'd execute this on the database
  if (!condition) return false;

  const conditionLower = condition.toLowerCase();
  
  // Simple heuristic-based matching
  if (conditionLower.includes(`auth.uid()`) && userId) {
    // Check if condition has user_id comparison
    if (conditionLower.includes('user_id') || conditionLower.includes('author_id')) {
      return true; // This would need actual evaluation
    }
  }

  if (conditionLower.includes(`auth.role()`) && userRole) {
    if (conditionLower.includes(userRole)) {
      return true;
    }
  }

  if (condition === 'true') {
    return true;
  }

  return false;
}

// Extract columns used in a policy condition
export function extractColumnsFromCondition(condition) {
  if (!condition) return [];

  const columnPattern = /(\w+)\s*=\s*|(\w+)\s*!=|(\w+)\s*<|(\w+)\s*>/g;
  const columns = [];
  let match;

  while ((match = columnPattern.exec(condition)) !== null) {
    const col = match[1] || match[2] || match[3] || match[4];
    if (col && !col.startsWith('auth') && !col.startsWith('current')) {
      columns.push(col);
    }
  }

  return [...new Set(columns)];
}
