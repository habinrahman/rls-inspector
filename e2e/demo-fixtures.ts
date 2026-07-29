/** Fixture RPC payloads for README demo recording (no live Supabase required). */

export const DEMO_TABLES = [
  { name: "posts", rls_enabled: true, policy_count: 3 },
];

export const DEMO_USERS = [
  { id: "00000000-0000-0000-0000-000000000001", email: "alice@example.com" },
];

export const DEMO_POLICIES = [
  {
    policyname: "Users can insert their own posts",
    cmd: "INSERT",
    qual: null,
    with_check: "(auth.uid() = user_id)",
  },
  {
    policyname: "Users can view their own posts",
    cmd: "SELECT",
    qual: "(auth.uid() = user_id)",
    with_check: null,
  },
  {
    policyname: "Anyone can update",
    cmd: "UPDATE",
    qual: "true",
    with_check: null,
  },
];

export const DEMO_PROJECT_URL = "https://demo-project.supabase.co";
export const DEMO_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo-anon-key-for-readme-recording-only";
