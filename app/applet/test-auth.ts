import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const env = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
env.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) process.env[key] = value;
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'nonexistent@example.com',
    password: 'wrongpassword'
  });
  console.log('Non-existent user:', error?.message);

  const { data: d2, error: e2 } = await supabase.auth.signInWithPassword({
    email: 'test@example.com', // assuming this exists
    password: 'wrongpassword'
  });
  console.log('Existent user:', e2?.message);
}

test();
