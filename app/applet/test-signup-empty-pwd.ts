import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://exalqemsksybzschzibp.supabase.co';
const supabaseAnonKey = 'sb_publishable_n4y-_oseQEu579QpfCzx8w_Ad1ixt7w';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

async function test() {
  const email = `test_${Date.now()}@example.com`;
  
  console.log('Checking non-existent email...');
  const { data: d1, error: e1 } = await supabase.auth.signUp({ email, password: '' });
  console.log('signUp non-existent:', { data: d1, error: e1 });

  console.log('Checking existing email...');
  const { data: d2, error: e2 } = await supabase.auth.signUp({ email: 'hamidra7a@gmail.com', password: '' });
  console.log('signUp existing:', { data: d2, error: e2 });
}

test();
