import React from 'react';
import { Play, Loader2, Table2, User } from 'lucide-react';

/**
 * Compact horizontal toolbar shown once a Supabase project is connected.
 * Holds the table picker, the "test as user" picker, and the analyze CTA.
 */
export default function AnalysisToolbar({
  tables,
  users,
  selectedTable,
  selectedUser,
  setSelectedUser,
  onTableChange,
  onAnalyze,
  loading,
}) {
  const canAnalyze = selectedTable && selectedUser && !loading;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-1.5 flex flex-wrap items-center gap-1.5">
      <Picker
        icon={Table2}
        value={selectedTable}
        onChange={onTableChange}
        ariaLabel="Select table"
        placeholder="Select table"
        emptyHint="No tables in public schema"
        options={tables.map((t) => {
          const name = typeof t === 'object' ? t.name : t;
          const meta =
            typeof t === 'object'
              ? [
                  t.rls_enabled === false ? 'no RLS' : null,
                  t.policy_count != null ? `${t.policy_count} ${t.policy_count === 1 ? 'policy' : 'policies'}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : '';
          return { value: name, label: name + (meta ? `  —  ${meta}` : '') };
        })}
      />

      <div className="h-6 w-px bg-zinc-800" aria-hidden />

      <Picker
        icon={User}
        value={selectedUser}
        onChange={setSelectedUser}
        ariaLabel="Select user"
        placeholder="Test as user"
        emptyHint="No users in auth.users"
        disabled={!selectedTable}
        options={users.map((u) => ({ value: u.id, label: u.email }))}
      />

      <div className="ml-auto" />

      <button
        type="button"
        onClick={() => onAnalyze(selectedTable, selectedUser)}
        disabled={!canAnalyze}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-emerald-500 text-zinc-950 font-semibold text-small hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed transition"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Analyzing
          </>
        ) : (
          <>
            <Play size={14} />
            Analyze
          </>
        )}
      </button>
    </div>
  );
}

function Picker({ icon: Icon, value, onChange, options, placeholder, ariaLabel, emptyHint, disabled }) {
  const isEmpty = options.length === 0;
  return (
    <div className="relative flex items-center">
      <Icon
        size={14}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
      />
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || isEmpty}
        className="h-8 pl-8 pr-2 text-small text-zinc-100 bg-transparent rounded-md hover:bg-zinc-800/60 focus:bg-zinc-800/80 focus:ring-1 focus:ring-emerald-500 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer min-w-[180px]"
      >
        <option value="">{isEmpty ? emptyHint : placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
