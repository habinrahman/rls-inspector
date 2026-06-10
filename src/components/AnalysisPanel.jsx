import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2, Lightbulb, Copy, Check, ChevronDown } from 'lucide-react';

export default function AnalysisPanel({ analysis }) {
  if (!analysis) return null;

  const issues = analysis.issues || [];
  const warnings = analysis.warnings || [];
  const suggestions = analysis.suggestions || [];
  const clean = issues.length === 0 && warnings.length === 0;

  return (
    <section className="mt-6 space-y-4 animate-in">
      <header className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <h2 className="text-h2 text-zinc-100">Findings</h2>
        <div className="flex items-center gap-3 text-small">
          <Pill
            icon={AlertTriangle}
            count={issues.length}
            tone="danger"
            label={issues.length === 1 ? 'critical' : 'critical'}
          />
          <Pill
            icon={AlertCircle}
            count={warnings.length}
            tone="warning"
            label={warnings.length === 1 ? 'warning' : 'warnings'}
          />
        </div>
      </header>

      {clean ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-start gap-3">
          <CheckCircle2 size={18} className="text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-h3 text-emerald-300">No issues detected</p>
            <p className="text-small text-zinc-400 mt-1">
              Policies look structurally sound. Continue to review with runtime testing.
            </p>
          </div>
        </div>
      ) : null}

      {issues.length > 0 && (
        <div className="space-y-2">
          {issues.map((issue, idx) => (
            <Finding key={`i-${idx}`} tone="danger" title={issue.title} description={issue.description} suggestion={issue.suggestion} />
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning, idx) => (
            <Finding
              key={`w-${idx}`}
              tone="warning"
              title="Review"
              description={typeof warning === 'string' ? warning : warning.description}
            />
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <details className="group rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
          <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer text-small text-zinc-300 select-none hover:bg-zinc-900/80 transition list-none">
            <Lightbulb size={14} className="text-zinc-400" />
            <span className="font-medium">{suggestions.length} best-practice suggestions</span>
            <ChevronDown size={14} className="ml-auto text-zinc-500 transition-transform group-open:rotate-180" />
          </summary>
          <ul className="px-4 pb-3 pt-1 space-y-2 border-t border-zinc-800/60">
            {suggestions.map((s, idx) => (
              <li key={`s-${idx}`} className="text-small text-zinc-400 py-2">
                <p className="text-zinc-200 mb-0.5">{s.title}</p>
                <p>{s.description}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Pill({ icon: Icon, count, tone, label }) {
  if (count === 0) return null;
  const tones = {
    danger: 'text-red-400',
    warning: 'text-amber-400',
  };
  return (
    <span className="inline-flex items-center gap-1.5 text-zinc-300">
      <Icon size={13} className={tones[tone]} />
      <span className="tabular-nums">{count}</span>
      <span className="text-zinc-500">{label}</span>
    </span>
  );
}

function Finding({ tone, title, description, suggestion }) {
  const tones = {
    danger:  { stripe: 'bg-red-500',   text: 'text-red-400',   label: 'Critical' },
    warning: { stripe: 'bg-amber-500', text: 'text-amber-400', label: 'Warning'  },
  };
  const t = tones[tone];

  return (
    <article className="relative rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-0.5 ${t.stripe}`} aria-hidden />
      <div className="pl-4 pr-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-micro uppercase ${t.text}`}>{t.label}</span>
          <span className="text-zinc-700">·</span>
          <h3 className="text-h3 text-zinc-100">{title}</h3>
        </div>
        <p className="text-small text-zinc-400">{description}</p>
        {suggestion && <SuggestedFix sql={suggestion} />}
      </div>
    </article>
  );
}

function SuggestedFix({ sql }) {
  const [copied, setCopied] = useState(false);

  // Strip the "Add a WITH CHECK clause to ensure data integrity:" preamble we
  // generate in analysis.js so the code block contains pure SQL.
  const lines = sql.split('\n');
  const sqlOnly = lines.length > 1 ? lines.slice(1).join('\n') : sql;
  const intro = lines.length > 1 ? lines[0] : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sqlOnly);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; do nothing */
    }
  };

  return (
    <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/60 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1 border-b border-zinc-800/60">
        <span className="text-micro uppercase text-zinc-500">{intro ? 'Suggested fix' : 'SQL'}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 text-micro uppercase text-zinc-400 hover:text-zinc-100 transition"
          aria-label="Copy SQL"
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-400" /> Copied
            </>
          ) : (
            <>
              <Copy size={12} /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="px-3 py-2 text-small font-mono text-zinc-200 overflow-x-auto whitespace-pre-wrap break-all">
        {sqlOnly}
      </pre>
    </div>
  );
}
