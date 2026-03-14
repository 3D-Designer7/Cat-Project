import { createClient } from '@supabase/supabase-js';

// Read from environment variables (set in .env.local or Vercel dashboard)
// Falls back to the project defaults if env vars are not set
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://exalqemsksybzschzibp.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_n4y-_oseQEu579QpfCzx8w_Ad1ixt7w';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
