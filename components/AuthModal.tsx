'use client';

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, Mail, Lock, User, Chrome, Eye, EyeOff } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { detectCountry } from '@/lib/country';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [is18Plus, setIs18Plus] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!isOpen) {
      setIsLogin(true);
      setEmail('');
      setPassword('');
      setUsername('');
      setGender('');
      setError('');
      setLoading(false);
      setIs18Plus(false);
      setShowPassword(false);
      setIsForgotPassword(false);
      setResetSent(false);
      setSuccessMsg('');
      setCooldown(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (isForgotPassword) {
        if (cooldown > 0) {
          setLoading(false);
          return;
        }

        // Check if user exists using the signUp trick
        const { data: checkData, error: checkError } = await supabase.auth.signUp({
          email,
          password: 'dummy_password_check_123!@#',
          options: {
            data: {
              is_check_only: true
            }
          }
        });

        if (checkError) {
          throw checkError;
        }

        // If identities is not empty, it means the user was just created (didn't exist before)
        if (checkData.user && checkData.user.identities && checkData.user.identities.length > 0) {
          setError('No account found with this email address.');
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/`,
        });
        
        if (error) {
          if (error.message.includes('For security purposes')) {
            // Rate limit hit, but email was likely already sent recently.
            // We'll just show the success message and start the cooldown.
            const match = error.message.match(/after (\d+) seconds/);
            const seconds = match ? parseInt(match[1], 10) : 60;
            setCooldown(seconds);
            setResetSent(true);
            setError('');
          } else {
            throw error;
          }
        } else {
          setResetSent(true);
          setError('');
          setCooldown(60);
        }
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onSuccess();
        onClose();
      } else {
        const blockedDomains = ['example.com', 'test.com', 'mailinator.com', 'tempmail.com', '10minutemail.com'];
        const emailDomain = email.split('@')[1]?.toLowerCase();
        if (emailDomain && blockedDomains.includes(emailDomain)) {
          setError('This email domain is not allowed. Please use a real email address.');
          setLoading(false);
          return;
        }

        if (!is18Plus) {
          setError('You must confirm that you are 18 or older to use CatChat.');
          setLoading(false);
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
              gender,
              is_18_plus: true,
            },
          },
        });
        if (signUpError) throw signUpError;
        
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setError('An account with this email already exists.');
          setLoading(false);
          return;
        }
        
        // Auto-detect country on sign up
        try {
          const countryData = await detectCountry();
          if (countryData) {
            await supabase.auth.updateUser({
              data: {
                country_name: countryData.country_name,
                country_code: countryData.country_code,
                country: countryData.country_code
              }
            });
          }
        } catch (err) {
          console.error("Failed to detect country during sign up", err);
        }

        // Redirect to sign in immediately
        setIsLogin(true);
        setPassword('');
        setError('');
        setSuccessMsg('Account created successfully! Please check your email to confirm your account.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      // Note: OAuth redirects, so onSuccess/onClose won't be called here.
    } catch (err: any) {
      setError(err.message || 'An error occurred during Google Sign-In.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
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
          <h2 className="text-2xl font-bold mb-2">
            {isForgotPassword ? 'Reset Password' : isLogin ? 'Welcome back' : 'Create an account'}
          </h2>
          <p className="text-foreground/60 text-sm mb-6">
            {isForgotPassword 
              ? 'Enter your email to receive a password reset link.' 
              : isLogin 
                ? 'Sign in to your account to continue.' 
                : 'Join Cat to save your preferences and connect.'}
          </p>

          {!isSupabaseConfigured && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-xl text-sm mb-6">
              Supabase is not configured. Please add your Supabase credentials to the environment variables.
            </div>
          )}

          {!isForgotPassword && (
            <>
              <button
                onClick={handleGoogleSignIn}
                disabled={loading || !isSupabaseConfigured}
                className="w-full flex items-center justify-center gap-2 bg-foreground text-background py-3 rounded-xl font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50 mb-6"
              >
                <Chrome size={18} />
                Continue with Google
              </button>

              <div className="relative flex items-center py-2 mb-6">
                <div className="flex-grow border-t border-border"></div>
                <span className="flex-shrink-0 mx-4 text-foreground/40 text-sm">Or continue with email</span>
                <div className="flex-grow border-t border-border"></div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && !isForgotPassword && (
              <>
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
                      required={!isLogin}
                      className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-accent transition-colors"
                      placeholder="coolcat99"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/60 mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    required={!isLogin}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:border-accent transition-colors text-foreground appearance-none"
                  >
                    <option value="" disabled className="bg-card">Select gender</option>
                    <option value="male" className="bg-card">Male</option>
                    <option value="female" className="bg-card">Female</option>
                    <option value="other" className="bg-card">Other</option>
                    <option value="prefer_not_to_say" className="bg-card">Prefer not to say</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground/60 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={16} className="text-foreground/40" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-accent transition-colors"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {!isForgotPassword && (
              <div>
                <label className="block text-sm font-medium text-foreground/60 mb-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock size={16} className="text-foreground/40" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-background border border-border rounded-xl pl-10 pr-12 py-3 focus:outline-none focus:border-accent transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground/40 hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {isLogin && (
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setError('');
                        setSuccessMsg('');
                      }}
                      className="text-sm text-accent hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
              </div>
            )}

            {!isLogin && !isForgotPassword && (
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
            )}

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</div>
            )}
            
            {successMsg && (
              <div className="text-green-400 text-sm bg-green-500/10 p-3 rounded-lg border border-green-500/20">{successMsg}</div>
            )}
            
            {resetSent && (
              <div className="text-green-400 text-sm bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                Password reset link sent. Please check your email inbox and spam folder.
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !isSupabaseConfigured || (isForgotPassword && cooldown > 0)}
              className="w-full bg-accent text-white py-3 rounded-xl font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? 'Please wait...' : isForgotPassword ? (cooldown > 0 ? `Resend link in ${cooldown}s` : 'Send Reset Link') : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-foreground/40">
            {isForgotPassword ? (
              <button 
                onClick={() => {
                  setIsForgotPassword(false);
                  setError('');
                  setSuccessMsg('');
                  setResetSent(false);
                }}
                className="text-accent hover:underline font-medium"
              >
                Back to sign in
              </button>
            ) : (
              <>
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button 
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="text-accent hover:underline font-medium"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
