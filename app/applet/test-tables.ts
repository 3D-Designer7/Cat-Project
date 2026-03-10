import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://exalqemsksybzschzibp.supabase.co';
const supabaseAnonKey = 'sb_publishable_n4y-_oseQEu579QpfCzx8w_Ad1ixt7w';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false
  }
});

async function test() {
  console.log('Checking if we can query auth.users...');
  const { data, error } = await supabase.from('auth.users').select('*').limit(1);
  console.log('auth.users:', { data, error });

  console.log('Checking if we can query profiles...');
  const { data: d2, error: e2 } = await supabase.from('profiles').select('*').limit(1);
  console.log('profiles:', { data: d2, error: e2 });
  
  console.log('Checking if we can query users...');
  const { data: d3, error: e3 } = await supabase.from('users').select('*').limit(1);
  console.log('users:', { data: d3, error: e3 });
}

test();
