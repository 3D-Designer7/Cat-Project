'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface AgeVerificationModalProps {
  isOpen: boolean;
  user: User | null;
  onSuccess: () => void;
}

export default function AgeVerificationModal({ isOpen, user, onSuccess }: AgeVerificationModalProps) {
  const [is18Plus, setIs18Plus] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIs18Plus(false);
      setError('');
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setLoading(true);
    setError('');

    try {
      if (!is18Plus) {
        setError('You must confirm that you are 18 or older to use CatChat.');
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: { is_18_plus: true }
      });

      if (updateError) throw updateError;
      
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to update age verification.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-red-500/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-8"
      >
        <h2 className="text-2xl font-bold mb-2 text-foreground">Age Verification Required</h2>
        <p className="text-foreground/60 text-sm mb-6">
          You must confirm your age to continue. This is required to ensure all users are 18+.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="flex items-start gap-3 p-3 bg-background border border-border rounded-xl cursor-pointer hover:bg-foreground/5 transition-colors">
              <input
                type="checkbox"
                checked={is18Plus}
                onChange={(e) => setIs18Plus(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-border text-accent focus:ring-accent bg-background"
              />
              <span className="text-sm text-foreground/80">
                I confirm that I am 18 years or older.
              </span>
            </label>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent text-white py-3 rounded-xl font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Verifying...' : 'Confirm Age'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
