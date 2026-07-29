# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.0.x   | ✅        |

## Reporting a vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Email **genai.microdegree@gmail.com** with:

- Description of the vulnerability
- Steps to reproduce
- Impact assessment
- Your GitHub username (optional, for credit)

Expect a response within **72 hours**.

## Scope

In scope:

- SQL injection via table name in RPC calls (client or server)
- Credential leakage beyond the documented browser-only model
- XSS in policy condition rendering
- Overly broad `GRANT EXECUTE` recommendations in setup SQL

Out of scope:

- The inherent risk of granting `get_auth_users()` to the `anon` role — this is documented in README and appropriate for dev/staging only
- Users entering their own Supabase credentials into the tool (by design)

## Security model reminder

RLS Inspector is **client-side only**. URL and anon key live in React state and are never sent to any server except the user's own Supabase project.

The SQL helpers in `setup_supabase_functions.sql` are read-only but elevated (`SECURITY DEFINER`). Review grants before installing on production databases with real user data.
