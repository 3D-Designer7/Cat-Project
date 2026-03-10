import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://exalqemsksybzschzibp.supabase.co';
const supabaseAnonKey = 'sb_publishable_n4y-_oseQEu579QpfCzx8w_Ad1ixt7w';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
