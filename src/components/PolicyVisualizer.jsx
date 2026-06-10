import React from 'react';
import { Eye, Plus, Pencil, Trash2, Database, Users } from 'lucide-react';

const CMD_META = {
  SELECT: { label: 'SELECT', Icon: Eye, accent: 'bg-blue-500', text: 'text-blue-400' },
  INSERT: { label: 'INSERT', Icon: Plus, accent: 'bg-emerald-500', text: 'text-emerald-400' },
  UPDATE: { label: 'UPDATE', Icon: Pencil, accent: 'bg-amber-500', text: 'text-amber-400' },
  DELETE: { label: 'DELETE', Icon: Trash2, accent: 'bg-red-500', text: 'text-red-400' },
  ALL:    { label: 'ALL',    Icon: Database, accent: 'bg-violet-500', text: 'text-violet-400' },
};

export default function PolicyVisualizer({ policies, table, totalRows }) {
  if (!policies || policies.length === 0) {
    return null;
  }

  const cmdCounts = policies.reduce((acc, p) => {
    acc[p.cmd] = (acc[p.cmd] || 0) + 1;
    return acc;
  }, {});

  return (
    <section className="animate-in">
      <header className="flex items-end justify-between mb-4 pb-3 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-micro uppercase text-zinc-500 mb-1">
            <Database size={12} />
            Table
          </div>
          <h2 className="text-h2 text-zinc-100 font-mono">{table}</h2>
        </div>
        <div className="flex items-center gap-4 text-small text-zinc-500">
          <Stat label="Policies" value={policies.length} />
          {totalRows != null && <Stat label="Rows" value={totalRows.toLocaleString()} />}
          {Object.entries(cmdCounts).map(([cmd, count]) => (
            <Stat
              key={cmd}
              label={cmd}
              value={count}
              labelClassName={CMD_META[cmd]?.text || 'text-zinc-400'}
            />
          ))}
        </div>
      </header>

      <ul className="space-y-2">
        {policies.map((policy, idx) => (
          <PolicyCard key={`${policy.policyname}-${idx}`} policy={policy} totalRows={totalRows} />
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value, labelClassName = 'text-zinc-500' }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-zinc-100 tabular-nums">{value}</span>
      <span className={`text-micro uppercase ${labelClassName}`}>{label}</span>
    </div>
  );
}

function PolicyCard({ policy, totalRows }) {
  const meta = CMD_META[policy.cmd] || CMD_META.SELECT;
  const { Icon } = meta;
  const isPermissive = policy.qual && policy.qual.trim().toLowerCase() === 'true';
  const missingCheck = (policy.cmd === 'INSERT' || policy.cmd === 'UPDATE') && !policy.with_check;
  const hasFinding = isPermissive || missingCheck;
  const roles = Array.isArray(policy.roles) ? policy.roles.filter((r) => r && r !== '{public}') : [];

  return (
    <li className="group relative rounded-lg border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 transition overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-0.5 ${meta.accent}`} aria-hidden />

      <div className="pl-4 pr-4 py-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <Icon size={14} className={`mt-0.5 shrink-0 ${meta.text}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-micro uppercase ${meta.text}`}>{meta.label}</span>
                <span className="text-zinc-700">·</span>
                <h3 className="text-h3 text-zinc-100 truncate">{policy.policyname}</h3>
                {policy.permissive === 'PERMISSIVE' && (
                  <Badge tone="neutral">permissive</Badge>
                )}
                {policy.permissive === 'RESTRICTIVE' && (
                  <Badge tone="neutral">restrictive</Badge>
                )}
              </div>
              {roles.length > 0 && (
                <p className="text-small text-zinc-500 mt-0.5 flex items-center gap-1.5">
                  <Users size={11} />
                  {roles.join(', ')}
                </p>
              )}
            </div>
          </div>

          {hasFinding && (
            <div className="flex items-center gap-1.5 shrink-0">
              {isPermissive && <Badge tone="warning">overly permissive</Badge>}
              {missingCheck && <Badge tone="danger">missing WITH CHECK</Badge>}
            </div>
          )}
        </div>

        {/* Condition blocks */}
        <div className="mt-3 grid grid-cols-1 gap-2">
          {policy.qual && (
            <CodeBlock label="USING" code={policy.qual} dangerous={isPermissive} />
          )}
          {policy.with_check && <CodeBlock label="WITH CHECK" code={policy.with_check} />}
          {!policy.with_check && (policy.cmd === 'INSERT' || policy.cmd === 'UPDATE') && (
            <div className="text-small text-zinc-500 font-mono pl-2 border-l border-zinc-800">
              <span className="text-zinc-600 mr-2">WITH CHECK</span>
              <span className="text-red-400/80">— not set —</span>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function CodeBlock({ label, code, dangerous }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/60 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1 border-b border-zinc-800/60">
        <span className="text-micro uppercase text-zinc-500">{label}</span>
        {dangerous && (
          <span className="text-micro uppercase text-amber-400">unrestricted</span>
        )}
      </div>
      <pre className="px-3 py-2 text-small font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  );
}

function Badge({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    danger:  'bg-red-500/10  text-red-400  border-red-500/30',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };
  return (
    <span
      className={`inline-flex items-center h-5 px-1.5 rounded text-[10px] font-medium uppercase tracking-wide border ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
