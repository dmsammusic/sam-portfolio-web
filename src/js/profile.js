import { supabase } from "./supabase-client.js";

// Shared by the navbar dropdown, the Settings page, and the login form — the one
// place profile reads/writes and username-login resolution happen, per the spec
// (issue #3) so those three surfaces don't each reimplement the same calls.

export async function getProfile() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  return data;
}

export async function updateProfile(fields) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: new Error("Not logged in") };

  return supabase.from("profiles").update(fields).eq("id", session.user.id);
}

// Supabase Auth's password sign-in only accepts an email, not a username, so a
// login identifier that isn't email-shaped gets resolved to its email first via
// a SECURITY DEFINER RPC (profiles' RLS otherwise blocks anon from reading any
// row at all). Returns null for an unknown username — the caller should show the
// same generic invalid-credentials message it would for a wrong password, so
// this lookup can't be used to enumerate registered usernames.
export async function resolveEmailForLogin(identifier) {
  if (identifier.includes("@")) return identifier;

  const { data, error } = await supabase.rpc("resolve_email_for_username", { check_username: identifier });
  if (error) return null;
  return data;
}
