import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://exalqemsksybzschzibp.supabase.co';
const supabaseAnonKey = 'sb_publishable_n4y-_oseQEu579QpfCzx8w_Ad1ixt7w';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

async function test() {
  console.log('Checking existing email...');
  const { data: d2, error: e2 } = await supabase.auth.signUp({ email: 'hamidra7a@gmail.com', password: 'password123' });
  console.log('signUp existing:', { data: d2, error: e2 });
}

test();
