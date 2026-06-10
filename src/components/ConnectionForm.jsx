import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, Globe, Loader2, ShieldCheck } from 'lucide-react';

/**
 * Centered connection card shown when the user has not yet connected to
 * a Supabase project. Replaces the old sidebar AuthPanel disconnected state.
 */
export default function ConnectionForm({ onConnect }) {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLocalError('');

    if (!url.trim() || !anonKey.trim()) {
      setLocalError('Both fields are required.');
      return;
    }
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.trim())) {
      setLocalError('URL should look like https://xxxx.supabase.co');
      return;
    }

    setSubmitting(true);
    try {
      await onConnect(url.trim(), anonKey.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-h2 text-zinc-100">Connect a Supabase project</h2>
          <p className="text-small text-zinc-400 mt-1">
            We use your public <span className="font-mono text-zinc-300">anon</span> key — no
            credentials leave the browser.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <Field
            label="Project URL"
            icon={Globe}
            input={
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xxxx.supabase.co"
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-9 pr-3 py-2 text-small text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              />
            }
          />

          <Field
            label="Anon (public) key"
            icon={KeyRound}
            helper="Settings → API → Project API keys → anon public"
            input={
              <>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhbGc..."
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-9 pr-9 py-2 text-small text-zinc-100 placeholder:text-zinc-600 font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 size-6 inline-flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </>
            }
          />

          {localError && (
            <p className="text-small text-red-400" role="alert">
              {localError}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-md bg-emerald-500 text-zinc-950 font-semibold text-small hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-[0_0_0_1px_rgba(16,185,129,0.4)]"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                Connect <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <div className="px-6 py-4 border-t border-zinc-800 flex items-start gap-2.5 text-small text-zinc-500">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-zinc-400" />
          <p>
            Requires four read-only SQL helpers installed in the target project.{' '}
            <span className="text-zinc-300">setup_supabase_functions.sql</span> is in the repo.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, helper, input }) {
  return (
    <div>
      <label className="block text-micro uppercase text-zinc-400 mb-1.5">{label}</label>
      <div className="relative">
        <Icon
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
        />
        {input}
      </div>
      {helper && <p className="text-small text-zinc-500 mt-1.5">{helper}</p>}
    </div>
  );
}
