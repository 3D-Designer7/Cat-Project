'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, User, Globe, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: SupabaseUser | null;
  onSuccess: () => void;
}

export default function ProfileModal({ isOpen, onClose, user, onSuccess }: ProfileModalProps) {
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setUsername(user.user_metadata?.username || '');
      setGender(user.user_metadata?.gender || '');
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    setLoading(true);
    setError('');

    try {
      if (username.length < 3 || username.length > 20) {
        throw new Error('Username must be between 3 and 20 characters.');
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        throw new Error('Username can only contain letters, numbers, and underscores.');
      }
      if (!gender) {
        throw new Error('Please select a gender.');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          username: username.trim(),
          gender,
        },
      });

      if (updateError) throw updateError;
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-foreground/40 hover:text-foreground transition-colors"
        >
          <X size={20} />
        </button>

        <div className="p-8">
          <h2 className="text-2xl font-bold mb-2 text-foreground">Edit Profile</h2>
          <p className="text-foreground/60 text-sm mb-6">
            Update your profile information. This will be visible to people you match with.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground/60 mb-1">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={16} className="text-foreground/40" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-accent transition-colors text-foreground"
                  placeholder="coolcat99"
                />
              </div>
              <p className="text-xs text-foreground/40 mt-1">3-20 characters, letters, numbers, _ only.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground/60 mb-1">Gender</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Users size={16} className="text-foreground/40" />
                </div>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                  className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-accent transition-colors text-foreground appearance-none"
                >
                  <option value="" disabled className="bg-card">Select your gender</option>
                  <option value="Male" className="bg-card">Male</option>
                  <option value="Female" className="bg-card">Female</option>
                  <option value="Non-binary" className="bg-card">Non-binary</option>
                  <option value="Prefer not to say" className="bg-card">Prefer not to say</option>
                </select>
              </div>
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
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
