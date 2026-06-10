/**
 * RLS Inspector
 * --------------------------------------------------------------------------
 * Visual debugger for Supabase Row Level Security policies.
 *
 * Talks to the user's Supabase project via PostgREST using only the public
 * anon key. The four read-only SQL helpers below MUST be installed in the
 * target project first (Supabase Dashboard → SQL Editor → paste & run
 * `setup_supabase_functions.sql`):
 *
 *   - get_all_tables()              → list public-schema tables + RLS state
 *   - get_table_policies(table_name) → fetch all policies for a table
 *   - get_auth_users(max_count?)    → list recent users from auth.users
 *   - get_table_row_count(table_name) → total rows (RLS-bypassed)
 *
 * If a helper is missing, the UI surfaces a clear "run setup_supabase_functions.sql"
 * message instead of a cryptic PostgREST error.
 * --------------------------------------------------------------------------
 */
import React, { useCallback, useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AlertCircle, Github, LogOut, ShieldCheck, X } from 'lucide-react';

import ConnectionForm from './components/ConnectionForm';
import AnalysisToolbar from './components/AnalysisToolbar';
import PolicyVisualizer from './components/PolicyVisualizer';
import AnalysisPanel from './components/AnalysisPanel';
import { detectIssues } from './lib/analysis';

const MISSING_HELPER_HINT =
  'Open the Supabase SQL Editor and run setup_supabase_functions.sql, then try again.';

// Postgres error code 42883 = "function does not exist" — the signal that the
// caller hasn't installed our helper RPCs yet.
const isMissingFunction = (err) =>
  !!err && (err.code === '42883' || /does not exist/i.test(err.message || ''));

const hostFromUrl = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

export default function RLSInspector() {
  const [supabase, setSupabase] = useState(null);
  const [projectHost, setProjectHost] = useState('');
  const [tables, setTables] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [policies, setPolicies] = useState([]);
  const [totalRows, setTotalRows] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);

  const handleConnect = useCallback(async (url, anonKey) => {
    setError('');
    try {
      const client = createClient(url, anonKey);
      const { data, error: rpcError } = await client.rpc('get_all_tables');

      if (rpcError) {
        if (isMissingFunction(rpcError)) {
          throw new Error(
            `Connected to Supabase, but the get_all_tables() helper is missing. ${MISSING_HELPER_HINT}`
          );
        }
        throw new Error(rpcError.message || 'Connection failed');
      }

      setTables(data || []);
      setSupabase(client);
      setProjectHost(hostFromUrl(url));
      setConnected(true);
    } catch (err) {
      setError(err.message || 'Connection failed');
      setConnected(false);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setSupabase(null);
    setProjectHost('');
    setTables([]);
    setUsers([]);
    setSelectedTable('');
    setSelectedUser('');
    setPolicies([]);
    setTotalRows(null);
    setAnalysis(null);
    setError('');
    setConnected(false);
  }, []);

  const handleTableChange = useCallback(
    async (table) => {
      setSelectedTable(table);
      setSelectedUser('');
      setPolicies([]);
      setAnalysis(null);
      if (!supabase || !table) return;

      try {
        const { data, error: userError } = await supabase.rpc('get_auth_users');
        if (userError) {
          if (isMissingFunction(userError)) {
            setError(`Could not load auth users: helper missing. ${MISSING_HELPER_HINT}`);
          } else {
            console.warn('get_auth_users RPC failed:', userError.message);
          }
          setUsers([
            { id: '00000000-0000-0000-0000-000000000001', email: 'sample-user-1@example.com' },
            { id: '00000000-0000-0000-0000-000000000002', email: 'sample-user-2@example.com' },
          ]);
        } else {
          setUsers(data || []);
        }
      } catch (err) {
        console.error('Error fetching users:', err);
        setUsers([]);
      }
    },
    [supabase]
  );

  const handleAnalyze = useCallback(
    async (table, userId) => {
      if (!table || !userId) {
        setError('Select both a table and a user.');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const [policiesRes, rowCountRes] = await Promise.all([
          supabase.rpc('get_table_policies', { table_name: table }),
          supabase.rpc('get_table_row_count', { table_name: table }),
        ]);

        if (policiesRes.error) {
          if (isMissingFunction(policiesRes.error)) {
            throw new Error(
              `The get_table_policies() helper is missing. ${MISSING_HELPER_HINT}`
            );
          }
          throw new Error(policiesRes.error.message);
        }

        const total =
          rowCountRes.error || rowCountRes.data == null ? null : Number(rowCountRes.data);
        setTotalRows(total);

        // With only the anon key we cannot truly impersonate `userId` to evaluate
        // each policy at runtime. We do structural / static analysis instead.
        const analyzedPolicies = (policiesRes.data || []).map((policy) => ({
          ...policy,
          matches: true,
          affected_rows: null,
          total_rows: total,
          performance_issue: null,
        }));

        setPolicies(analyzedPolicies);
        setAnalysis(detectIssues(analyzedPolicies, table));
      } catch (err) {
        setError('Failed to analyze policies: ' + err.message);
        setPolicies([]);
        setAnalysis(null);
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  // Cmd/Ctrl+K focuses the analyze flow — small keyboard nicety.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('select[aria-label="Select table"]')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <TopBar
        connected={connected}
        projectHost={projectHost}
        onDisconnect={handleDisconnect}
      />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {!connected ? (
          <DisconnectedView error={error} onConnect={handleConnect} />
        ) : (
          <ConnectedView
            tables={tables}
            users={users}
            selectedTable={selectedTable}
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            onTableChange={handleTableChange}
            onAnalyze={handleAnalyze}
            loading={loading}
            error={error}
            dismissError={() => setError('')}
            policies={policies}
            totalRows={totalRows}
            analysis={analysis}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Layout pieces                                                             */
/* ------------------------------------------------------------------------ */

function TopBar({ connected, projectHost, onDisconnect }) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo />
          <div className="flex items-baseline gap-2">
            <span className="text-h3 text-zinc-100">RLS Inspector</span>
            <span className="hidden sm:inline text-micro uppercase text-zinc-500">
              Supabase debugger
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connected && (
            <button
              type="button"
              onClick={onDisconnect}
              className="group inline-flex items-center gap-2 h-8 px-2.5 rounded-md border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 transition"
              title="Disconnect"
            >
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
              <span className="text-small font-mono text-zinc-300 max-w-[200px] truncate">
                {projectHost}
              </span>
              <LogOut size={12} className="text-zinc-500 group-hover:text-zinc-300 transition" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <div className="size-7 rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-zinc-950 font-bold text-[11px] tracking-tight">
      RLS
    </div>
  );
}

function DisconnectedView({ error, onConnect }) {
  return (
    <div className="pt-12 sm:pt-20">
      <div className="text-center mb-8">
        <h1 className="text-display text-zinc-100">Debug your Supabase RLS policies</h1>
        <p className="text-small text-zinc-400 mt-2 max-w-md mx-auto">
          See every policy on a table, find missing <span className="font-mono">WITH CHECK</span>{' '}
          clauses, and catch overly-permissive rules before they ship.
        </p>
      </div>

      {error && <ErrorAlert message={error} className="max-w-md mx-auto mb-4" />}

      <ConnectionForm onConnect={onConnect} />
    </div>
  );
}

function ConnectedView({
  tables, users, selectedTable, selectedUser,
  setSelectedUser, onTableChange, onAnalyze,
  loading, error, dismissError,
  policies, totalRows, analysis,
}) {
  return (
    <div className="space-y-6">
      <AnalysisToolbar
        tables={tables}
        users={users}
        selectedTable={selectedTable}
        selectedUser={selectedUser}
        setSelectedUser={setSelectedUser}
        onTableChange={onTableChange}
        onAnalyze={onAnalyze}
        loading={loading}
      />

      {error && <ErrorAlert message={error} onDismiss={dismissError} />}

      {loading && <PoliciesSkeleton />}

      {!loading && policies.length > 0 && (
        <>
          <PolicyVisualizer policies={policies} table={selectedTable} totalRows={totalRows} />
          <AnalysisPanel analysis={analysis} />
        </>
      )}

      {!loading && policies.length === 0 && !error && (
        <EmptyState
          tablesCount={tables.length}
          hasTable={!!selectedTable}
          hasUser={!!selectedUser}
        />
      )}
    </div>
  );
}

function ErrorAlert({ message, onDismiss, className = '' }) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 ${className}`}
    >
      <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
      <p className="text-small text-red-200 whitespace-pre-line flex-1">{message}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-red-300/60 hover:text-red-200 transition shrink-0"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function PoliciesSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading policies">
      <div className="flex items-end justify-between mb-4 pb-3 border-b border-zinc-800">
        <div className="space-y-2">
          <div className="skeleton h-3 w-12" />
          <div className="skeleton h-6 w-40" />
        </div>
        <div className="skeleton h-3 w-48" />
      </div>
      <ul className="space-y-2">
        {[0, 1, 2].map((i) => (
          <li key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="skeleton size-3.5 rounded-full" />
              <div className="skeleton h-3 w-12" />
              <div className="skeleton h-4 w-48" />
            </div>
            <div className="skeleton h-12 w-full rounded-md" />
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyState({ tablesCount, hasTable, hasUser }) {
  let title, body;
  if (tablesCount === 0) {
    title = 'No tables found in this project';
    body = 'Create a table in the public schema and enable RLS, then refresh.';
  } else if (!hasTable) {
    title = 'Pick a table to inspect';
    body = 'Use the table selector above to choose any public-schema table.';
  } else if (!hasUser) {
    title = 'Pick a user to test as';
    body = 'Choose any user from auth.users to anchor the analysis.';
  } else {
    title = 'Ready to analyze';
    body = 'Click Analyze to fetch policies and run the static checks.';
  }

  return (
    <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/20 px-6 py-12 text-center">
      <div className="mx-auto size-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3">
        <ShieldCheck size={18} className="text-zinc-500" />
      </div>
      <p className="text-h3 text-zinc-200">{title}</p>
      <p className="text-small text-zinc-500 mt-1">{body}</p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-900 mt-12">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between text-small text-zinc-500">
        <span>
          Client-side only · credentials never leave your browser ·{' '}
          <span className="font-mono text-zinc-400">setup_supabase_functions.sql</span> is the
          only server surface
        </span>
        <a
          href="https://github.com/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-zinc-300 transition"
        >
          <Github size={13} />
          <span>Source</span>
        </a>
      </div>
    </footer>
  );
}
