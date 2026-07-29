# Contributing to RLS Inspector

Thanks for helping improve a tool that saves Supabase developers from opaque `permission denied` errors.

## Quick start

```bash
git clone https://github.com/habinrahman/rls-inspector.git
cd rls-inspector
npm install
npm run dev          # http://localhost:5173
npm test             # vitest unit tests for analysis.js
npm run build        # production bundle
```

## Ground rules

1. **No new dependencies without justification.** The ~9-dependency total is intentional — explain in the PR why a new one is needed.
2. **No emoji in the UI.** Use [lucide-react](https://lucide-react.dev) icons only.
3. **Match existing patterns:** functional components, Tailwind for styling, flat component structure.
4. **Test analysis changes.** Any change to `src/lib/analysis.js` must include or update tests in `analysis.test.js`.

## Pull requests

- Branch from `main`: `feat/…`, `fix/…`, `docs/…`
- Run `npm test && npm run build` before pushing
- Describe **why** the change helps Supabase developers
- Link related issues when applicable

## Reporting issues

Use the [bug report](.github/ISSUE_TEMPLATE/bug_report.yml) or [feature request](.github/ISSUE_TEMPLATE/feature_request.yml) templates.

## Security

Do not open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## Code of conduct

[Contributor Covenant](CODE_OF_CONDUCT.md) applies to all interactions.
