'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    if (supabase) {
      // Supabase automatically handles the OAuth callback and sets the session
      // We just need to wait for it and redirect
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
          router.push('/');
        }
      });

      // Fallback redirect if the event doesn't fire
      const timer = setTimeout(() => {
        router.push('/');
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      router.push('/');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center text-white">
      <Loader2 size={48} className="animate-spin text-[#6C63FF] mb-4" />
      <p className="text-gray-400 font-mono tracking-widest uppercase text-sm">Completing sign in...</p>
    </div>
  );
}
