import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DAD_STORAGE_PROFILE_ID } from "../dataBins";

export const DAD_WORKSPACE_ID = DAD_STORAGE_PROFILE_ID;

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL!.trim();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY!.trim();

  client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: { eventsPerSecond: 8 },
    },
  });

  return client;
}
