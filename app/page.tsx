'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { Video, Mic, MicOff, MessageSquare, AlertTriangle, ShieldAlert, SkipForward, XCircle, Users, Loader2, LogOut, User as UserIcon, Image as ImageIcon } from 'lucide-react';
import AuthModal from '@/components/AuthModal';
import ResetPasswordModal from '@/components/ResetPasswordModal';
import AgeVerificationModal from '@/components/AgeVerificationModal';
import { supabase } from '@/lib/supabase';
import { detectCountry } from '@/lib/country';
import { User } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { SocketMatchmaker, SocketRoom } from '@/lib/socket';
import ProfileModal from '@/components/ProfileModal';
import { detectUserCountry } from '@/lib/countries';
import { CatChatLogo, CatChatLogoCompact } from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { useTheme } from '@/components/ThemeProvider';

type ChatMode = 'text' | 'video' | 'voice' | null;

export default function Home() {
  const { theme } = useTheme();
  const [mode, setMode] = useState<ChatMode>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  const matchmakerRef = useRef<SocketMatchmaker | null>(null);
  const roomRef = useRef<SocketRoom | null>(null);
  const myUserIdRef = useRef<string>(uuidv4());
  
  const [messages, setMessages] = useState<{ id: string; text: string; imageUrl?: string; sender: 'me' | 'stranger' }[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerName, setPartnerNameState] = useState('Stranger');
  const [partnerSubtitle, setPartnerSubtitle] = useState<React.ReactNode | null>(null);
  const partnerNameRef = useRef('Stranger');

  const [detectedCountry, setDetectedCountry] = useState<{ country_name: string; country_code: string } | null>(null);
  const detectedCountryRef = useRef<{ country_name: string; country_code: string } | null>(null);

  useEffect(() => {
    detectUserCountry().then(data => {
      if (data) {
        setDetectedCountry(data);
        detectedCountryRef.current = data;
      }
    });
  }, []);

  const setPartnerName = (name: string) => {
    setPartnerNameState(name);
    partnerNameRef.current = name;
  };
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isAgeModalOpen, setIsAgeModalOpen] = useState(false);
  const [user, setUserState] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    userRef.current = newUser;
    
    // Check for is_18_plus if user exists
    if (newUser) {
      const is18Plus = newUser.user_metadata?.is_18_plus;
      if (!is18Plus) {
        setIsAgeModalOpen(true);
      } else {
        setIsAgeModalOpen(false);
      }
    } else {
      setIsAgeModalOpen(false);
    }
  };

  const matchedModeRef = useRef<ChatMode>(null);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const zgRef = useRef<any>(null);
  const localZegoStreamRef = useRef<any>(null);
  const remoteZegoStreamRef = useRef<any>(null);
  const publishedStreamIdRef = useRef<string | null>(null);
  const roomIdRef = useRef<string | null>(null);
  const msgIdCounter = useRef(0);

  // Attach streams to refs when they change or when the component re-renders
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isConnected, mode, isSearching]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isConnected, mode, isSearching]);

  useEffect(() => {
    if (supabase) {
      // Get initial session
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
      });

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        setUser(session?.user ?? null);
        
        if (event === 'PASSWORD_RECOVERY') {
          setIsResetPasswordModalOpen(true);
        }

        if (event === 'SIGNED_IN' && session?.user) {
          const user = session.user;
          // Check if country is missing
          if (!user.user_metadata?.country_code && !user.user_metadata?.country) {
            try {
              const countryData = await detectCountry();
              if (countryData && supabase) {
                await supabase.auth.updateUser({
                  data: {
                    country_name: countryData.country_name,
                    country_code: countryData.country_code,
                    country: countryData.country_code // for backwards compatibility
                  }
                });
                // Refresh session to get updated metadata
                const { data: { session: newSession } } = await supabase.auth.getSession();
                setUser(newSession?.user ?? null);
              }
            } catch (err) {
              console.error("Failed to detect country after login", err);
            }
          }
        }
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (!user && isConnected) {
      // User logged out or session expired while connected
      if (matchmakerRef.current) {
        matchmakerRef.current.stop();
        matchmakerRef.current = null;
      }
      if (roomRef.current) {
        roomRef.current.stop();
        roomRef.current = null;
      }
      cleanupZego();
      setIsConnected(false);
      setIsSearching(false);
      setMode(null);
      setMessages([]);
      setIsAuthModalOpen(false); // Close auth modal if open (optional, maybe keep it open to force login?)
      // Actually, if they sign out, we want them to see the home screen, so closing modals is fine.
      setIsAgeModalOpen(false);
    }
  }, [user, isConnected]);

  function getNextMsgId() {
    msgIdCounter.current += 1;
    return msgIdCounter.current.toString();
  }

  function cleanupZego() {
    const zg = zgRef.current;
    if (zg) {
      if (publishedStreamIdRef.current) {
        zg.stopPublishingStream(publishedStreamIdRef.current);
        publishedStreamIdRef.current = null;
      }
      if (localZegoStreamRef.current) {
        zg.destroyStream(localZegoStreamRef.current);
        localZegoStreamRef.current = null;
      }
      if (roomIdRef.current) {
        zg.logoutRoom(roomIdRef.current);
      }
    }
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
      localVideoRef.current.load();
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
      remoteVideoRef.current.load();
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.load();
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
  }

  async function setupZego(roomId: string, mode: ChatMode) {
    if (mode !== 'video' && mode !== 'voice') return;

    try {
      const { ZegoExpressEngine } = await import('zego-express-engine-webrtc');
      const appId = Number(process.env.NEXT_PUBLIC_ZEGOCLOUD_APP_ID);
      const serverUrl = `wss://webliveroom${appId}-api.zego.im/ws`;
      
      let zg = zgRef.current;
      if (!zg) {
        zg = new ZegoExpressEngine(appId, serverUrl);
        zgRef.current = zg;
        
        zg.on('roomStreamUpdate', async (roomID: string, updateType: string, streamList: any[]) => {
          if (updateType === 'ADD') {
            const stream = await zg.startPlayingStream(streamList[0].streamID);
            remoteZegoStreamRef.current = stream;
            setRemoteStream(stream);
          } else if (updateType === 'DELETE') {
            zg.stopPlayingStream(streamList[0].streamID);
            remoteZegoStreamRef.current = null;
            setRemoteStream(null);
          }
        });
      }

      const userId = myUserIdRef.current;
      const res = await fetch(`/api/zego/token?userId=${userId}&roomId=${roomId}`);
      const { token } = await res.json();

      const username = userRef.current?.user_metadata?.username || userRef.current?.user_metadata?.full_name || userRef.current?.email?.split('@')[0] || 'Stranger';
      
      await zg.loginRoom(roomId, token, { userID: userId, userName: username }, { userUpdate: true });

      const localStream = await zg.createStream({
        camera: { video: mode === 'video', audio: true }
      });
      
      localZegoStreamRef.current = localStream;
      setLocalStream(localStream);
      
      const streamId = `${roomId}_${userId}`;
      publishedStreamIdRef.current = streamId;
      zg.startPublishingStream(streamId, localStream);

    } catch (error) {
      console.error('Error setting up ZEGOCLOUD:', error);
      alert('Could not access camera/microphone or connect to media server. Please check permissions.');
    }
  }

  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (uploadedFilesRef.current.length > 0) {
        // Use navigator.sendBeacon or fetch with keepalive if possible, 
        // but Supabase client might not support it directly.
        // We attempt a best-effort cleanup.
        deleteSessionFiles();
      }
      if (matchmakerRef.current) matchmakerRef.current.stop();
      if (roomRef.current) roomRef.current.stop();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (matchmakerRef.current) matchmakerRef.current.stop();
      if (roomRef.current) roomRef.current.stop();
      cleanupZego();
    };
  }, []);

  const [isMuted, setIsMuted] = useState(false);
  const [socketStatus, setSocketStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [queueCount, setQueueCount] = useState(0);

  const toggleMute = () => {
    const zg = zgRef.current;
    if (zg && localZegoStreamRef.current && publishedStreamIdRef.current) {
      const newMutedState = !isMuted;
      zg.mutePublishStreamAudio(localZegoStreamRef.current, newMutedState);
      setIsMuted(newMutedState);
    }
  };

  const startMatchmaking = (selectedMode: ChatMode) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }
    
    // Enforce 18+ check
    const is18Plus = user.user_metadata?.is_18_plus;
    if (!is18Plus) {
      setIsAgeModalOpen(true);
      return;
    }
    
    if (!selectedMode) return;
    
    // Stop existing matchmaker or room
    if (matchmakerRef.current) {
      matchmakerRef.current.stop();
      matchmakerRef.current = null;
    }
    if (roomRef.current) {
      roomRef.current.stop();
      roomRef.current = null;
    }
    
    setMode(selectedMode);
    matchedModeRef.current = selectedMode;
    setIsSearching(true);
    setMessages([]);
    setIsConnected(false);
    
    const username = userRef.current?.user_metadata?.username || userRef.current?.user_metadata?.full_name || userRef.current?.email?.split('@')[0] || 'Stranger';
    
    // Always use detected country if available, otherwise fallback to profile country or empty
    let country = detectedCountryRef.current?.country_code || userRef.current?.user_metadata?.country || '';
    
    const gender = userRef.current?.user_metadata?.gender || '';
    
    const matchmaker = new SocketMatchmaker(
      myUserIdRef.current,
      username,
      country,
      gender,
      selectedMode,
      async (roomId, partnerId, pName, pCountry, pGender, isInitiator, socket) => {
        // Do not cleanup matchmaker listeners here so we can reuse the socket for skipping
        
        setIsSearching(false);
        setIsConnected(true);
        
        const displayName = pName || 'Stranger';
        setPartnerName(displayName);
        
        let subtitle: React.ReactNode = null;
        if (pCountry) {
          let pronoun = 'They are';
          if (pGender) {
            const g = pGender.toLowerCase();
            if (g === 'male') pronoun = 'He is';
            else if (g === 'female') pronoun = 'She is';
          }
          
          subtitle = (
            <span className="flex items-center justify-center gap-1">
              {pronoun} from <Image src={`https://flagcdn.com/w20/${pCountry.toLowerCase()}.png`} width={16} height={12} alt={pCountry} className="inline-block" unoptimized />
            </span>
          );
        }
        setPartnerSubtitle(subtitle);

        roomIdRef.current = roomId;
        setMessages([]); // Clear previous messages
        
        // Create room
        const room = new SocketRoom(roomId, myUserIdRef.current, country, gender, socket, {
          onMessage: (message, imageUrl) => {
            setMessages(prev => [...prev, { id: getNextMsgId(), text: message, imageUrl, sender: 'stranger' }]);
          },
          onPartnerJoined: () => {
            // Partner joined the room
          },
          onReady: () => {
            // Partner is ready
          },
          onPartnerLeft: () => {
            setIsConnected(false);
            setMessages(prev => [...prev, { id: getNextMsgId(), text: `${partnerNameRef.current} has disconnected. Searching for a new partner...`, sender: 'stranger' }]);
            cleanupZego();
            
            if (roomRef.current) {
              roomRef.current.leave();
              roomRef.current = null;
            }
            
            // The server automatically places us back in the queue
            setIsSearching(true);
            setPartnerName('Stranger');
          },
          onTyping: (isTyping) => {
            setPartnerTyping(isTyping);
          }
        });
        
        roomRef.current = room;
        
        if (selectedMode === 'video' || selectedMode === 'voice') {
          await setupZego(roomId, selectedMode);
        }

        await room.start();
        room.sendReady();
      },
      (status, count) => {
        setSocketStatus(status);
        if (count !== undefined) setQueueCount(count);
      }
    );
    
    matchmakerRef.current = matchmaker;
    matchmaker.start();
  };

  const startChat = (selectedMode: ChatMode) => {
    startMatchmaking(selectedMode);
  };

  const [isSkipping, setIsSkipping] = useState(false);

  const skipChat = async () => {
    if (isSkipping) return;
    setIsSkipping(true);

    if (roomRef.current) {
      roomRef.current.leave();
      roomRef.current = null;
    }
    
    if (matchmakerRef.current) {
      matchmakerRef.current.skip();
    }
    
    cleanupZego();
    
    // Cleanup session files
    await deleteSessionFiles();

    setIsConnected(false);
    setMessages([]);
    setIsSearching(true);
    setPartnerName('Stranger');
    
    setTimeout(() => {
      setIsSkipping(false);
    }, 500);
  };

  const endChat = async () => {
    if (roomRef.current) {
      roomRef.current.stop();
      roomRef.current = null;
    }
    if (matchmakerRef.current) {
      matchmakerRef.current.stop();
      matchmakerRef.current = null;
    }
    cleanupZego();
    
    // Cleanup session files
    await deleteSessionFiles();

    setIsConnected(false);
    setIsSearching(false);
    setMode(null);
    setMessages([]);
    setPartnerName('Stranger');
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !roomRef.current || !roomIdRef.current) return;

    const newMsg = { id: getNextMsgId(), text: inputMessage, sender: 'me' as const };
    setMessages(prev => [...prev, newMsg]);
    roomRef.current.sendMessage(inputMessage);
    setInputMessage('');
    handleTyping(false);
  };

  const handleTyping = (typing: boolean) => {
    setIsTyping(typing);
    if (roomRef.current && roomIdRef.current) {
      roomRef.current.sendTyping(typing);
    }
  };

  const uploadedFilesRef = useRef<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Load leftover files from localStorage on mount and try to delete them
  useEffect(() => {
    const cleanupLeftovers = async () => {
      const storedFiles = localStorage.getItem('cat_leftover_files');
      if (storedFiles) {
        try {
          const filesToDelete = JSON.parse(storedFiles);
          if (Array.isArray(filesToDelete) && filesToDelete.length > 0 && supabase) {
            console.log('Cleaning up leftover files from previous session:', filesToDelete);
            await supabase.storage.from('chat-images').remove(filesToDelete);
            localStorage.removeItem('cat_leftover_files');
          }
        } catch (e) {
          console.error('Error cleaning up leftovers:', e);
        }
      }
    };
    cleanupLeftovers();
  }, []);

  const deleteSessionFiles = async () => {
    if (uploadedFilesRef.current.length === 0) return;
    
    const filesToDelete = [...uploadedFilesRef.current];
    
    try {
      if (!supabase) return;
      const { error } = await supabase.storage
        .from('chat-images')
        .remove(filesToDelete);
      
      if (error) {
        console.error('Error cleaning up session files:', error);
      } else {
        uploadedFilesRef.current = [];
        // Clear from local storage as they are successfully deleted
        const stored = localStorage.getItem('cat_leftover_files');
        if (stored) {
          const currentStored = JSON.parse(stored);
          const newStored = currentStored.filter((f: string) => !filesToDelete.includes(f));
          if (newStored.length > 0) {
            localStorage.setItem('cat_leftover_files', JSON.stringify(newStored));
          } else {
            localStorage.removeItem('cat_leftover_files');
          }
        }
      }
    } catch (err) {
      console.error('Failed to delete session files:', err);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomRef.current || !roomIdRef.current) return;

    // Check if user is authenticated
    if (!supabase) {
      alert('Supabase not initialized');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert('You must be signed in to upload images.');
      setIsAuthModalOpen(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size too large. Max 5MB.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Invalid file type. Please upload an image.');
      return;
    }

    setIsUploading(true);
    try {
      if (!supabase) throw new Error('Supabase not initialized');
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `${roomIdRef.current}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type
        });

      if (uploadError) {
        console.error('Supabase Upload Error:', uploadError);
        // Map Supabase errors to user-friendly messages
        if (uploadError.message.includes('row-level security')) {
          throw new Error('Permission denied. Please try signing in again.');
        } else if (uploadError.message.includes('storage quota')) {
          throw new Error('Storage quota exceeded.');
        } else if (uploadError.message.includes('mime type')) {
          throw new Error('Invalid file type.');
        } else {
          throw new Error(uploadError.message || 'Upload failed. Please check your connection.');
        }
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(filePath);

      // Track file for cleanup
      uploadedFilesRef.current.push(filePath);
      
      // Update localStorage backup
      const stored = localStorage.getItem('cat_leftover_files');
      const currentStored = stored ? JSON.parse(stored) : [];
      currentStored.push(filePath);
      localStorage.setItem('cat_leftover_files', JSON.stringify(currentStored));

      const newMsg = { id: getNextMsgId(), text: '', imageUrl: publicUrl, sender: 'me' as const };
      setMessages(prev => [...prev, newMsg]);
      roomRef.current.sendMessage('', publicUrl);
    } catch (error: any) {
      console.error('Error uploading image:', error);
      alert(`Failed to upload image: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <main className="h-[100dvh] bg-background text-foreground font-sans flex flex-col overflow-hidden pb-safe">
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onSuccess={async () => {
          if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            setUser(session?.user ?? null);
            setIsAuthModalOpen(false);
          }
        }} 
      />

      <ResetPasswordModal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
      />
      
      <AgeVerificationModal
        isOpen={isAgeModalOpen}
        user={user}
        onSuccess={async () => {
          setIsAgeModalOpen(false);
          if (supabase) {
            // Refresh user to get updated metadata
            const { data: { user: refreshedUser } } = await supabase.auth.refreshSession();
            setUser(refreshedUser);
          }
        }}
      />

      {/* Header */}
      <header className="p-4 border-b border-border grid grid-cols-[auto_1fr_auto] items-center bg-card shrink-0 gap-2 md:gap-4">
        <div className="flex items-center gap-2">
          <CatChatLogoCompact className="w-8 h-8" />
          <h1 className="text-xl font-bold tracking-tight hidden md:block">CatChat</h1>
        </div>
        
        <div className="flex flex-col items-center justify-center min-w-0 px-2">
          {isConnected ? (
            <>
              <span className="font-bold text-sm md:text-base truncate max-w-full">{partnerName}</span>
              {partnerSubtitle && (
                <span className="text-[10px] md:text-xs text-gray-400 text-center leading-tight truncate max-w-full">
                  {partnerSubtitle}
                </span>
              )}
            </>
          ) : (
            <div className="text-xs text-gray-400 font-mono tracking-wider uppercase">
              {isSearching ? 'Searching...' : (user ? 'Online' : 'Offline')}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {user ? (
            <div className="flex items-center gap-2 md:gap-3">
              <button 
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center gap-2 bg-background px-3 py-1.5 rounded-full border border-border hover:bg-foreground/5 transition-colors"
                title="Edit Profile"
              >
                {user.user_metadata?.avatar_url ? (
                  <Image 
                    src={user.user_metadata.avatar_url} 
                    alt="Profile" 
                    width={20} 
                    height={20} 
                    className="rounded-full" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <UserIcon size={16} className="text-foreground/60" />
                )}
                <span className="text-sm font-medium text-foreground hidden md:inline">
                  {user.user_metadata?.username || user.user_metadata?.full_name || user.email?.split('@')[0]}
                </span>
                {(user.user_metadata?.country || detectedCountry) && (
                   <span className="text-sm ml-1 flex items-center">
                     <Image 
                       src={`https://flagcdn.com/w20/${(user.user_metadata?.country || detectedCountry?.country_code || '').toLowerCase()}.png`} 
                       width={16} 
                       height={12} 
                       alt={user.user_metadata?.country || detectedCountry?.country_code || ''} 
                       className="inline-block" 
                       unoptimized
                     />
                   </span>
                )}
              </button>
              <button 
                onClick={() => supabase && supabase.auth.signOut()}
                className="text-foreground/60 hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-foreground/5"
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-accent hover:bg-accent/90 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
            >
              Sign In
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <AnimatePresence mode="wait">
          {!mode && !isSearching && !isConnected && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center p-4 max-w-4xl mx-auto w-full overflow-hidden"
            >
              <div className="text-center mb-6 md:mb-8">
                <h2 className="text-3xl md:text-5xl font-bold mb-2 md:mb-3 tracking-tighter">
                  Talk to <span className="text-accent">Strangers</span>
                </h2>
                <p className="text-foreground/60 text-sm md:text-base max-w-2xl mx-auto px-4">
                  Meet new people instantly. Anonymous, secure, and fast.
                  Must be 18+ to use this service.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 w-full max-w-3xl">
                <button 
                  onClick={() => startChat('text')}
                  className="group relative bg-card border border-border rounded-2xl p-3 md:p-6 hover:border-accent/50 transition-all duration-300 overflow-hidden flex md:block items-center text-left md:text-center gap-4 md:gap-0"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <MessageSquare size={24} className="text-accent shrink-0 md:mb-4 md:w-10 md:h-10 md:mx-auto" />
                  <div>
                    <h3 className="text-base md:text-xl font-semibold mb-0.5 md:mb-2">Text Chat</h3>
                    <p className="text-foreground/60 text-[10px] md:text-xs">Classic anonymous messaging.</p>
                  </div>
                </button>

                <button 
                  onClick={() => startChat('video')}
                  className="group relative bg-card border border-border rounded-2xl p-3 md:p-6 hover:border-[#FF6584]/50 transition-all duration-300 overflow-hidden flex md:block items-center text-left md:text-center gap-4 md:gap-0"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#FF6584]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Video size={24} className="text-[#FF6584] shrink-0 md:mb-4 md:w-10 md:h-10 md:mx-auto" />
                  <div>
                    <h3 className="text-base md:text-xl font-semibold mb-0.5 md:mb-2">Video Chat</h3>
                    <p className="text-foreground/60 text-[10px] md:text-xs">Face-to-face conversations.</p>
                  </div>
                </button>

                <button 
                  onClick={() => startChat('voice')}
                  className="group relative bg-card border border-border rounded-2xl p-3 md:p-6 hover:border-emerald-500/50 transition-all duration-300 overflow-hidden flex md:block items-center text-left md:text-center gap-4 md:gap-0"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <Mic size={24} className="text-emerald-500 shrink-0 md:mb-4 md:w-10 md:h-10 md:mx-auto" />
                  <div>
                    <h3 className="text-base md:text-xl font-semibold mb-0.5 md:mb-2">Voice Chat</h3>
                    <p className="text-foreground/60 text-[10px] md:text-xs">Audio only. Perfect for language exchange.</p>
                  </div>
                </button>
              </div>
              
              <div className="mt-6 md:mt-8 text-xs text-gray-500 flex flex-col items-center gap-2 px-4 text-center justify-center">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={14} className="shrink-0" />
                  By using CatChat, you agree to our Terms of Service and confirm you are 18 or older.
                </div>
                <a href="/privacy" className="underline hover:text-gray-300 transition-colors">Privacy Policy</a>
              </div>
            </motion.div>
          )}

          {(isSearching || isConnected) && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col md:flex-row h-full overflow-hidden"
            >
              {/* Media Area (Video/Voice) */}
              {(mode === 'video' || mode === 'voice') && (
                <div className="flex-1 md:flex-[2] bg-black relative flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-border overflow-hidden min-h-0">
                  {isSearching ? (
                      <div className="flex flex-col items-center gap-4 text-gray-400">
                        <Loader2 size={48} className="animate-spin text-[#6C63FF]" />
                        <div className="text-center">
                          <p className="font-mono tracking-widest uppercase text-sm mb-1">Looking for someone...</p>
                          <p className="text-[10px] opacity-50 uppercase tracking-tighter">
                            Server: {socketStatus === 'connected' ? 'Connected' : 'Connecting...'}
                            {socketStatus === 'connected' && ` • Waiting: ${queueCount}`}
                          </p>
                        </div>
                      </div>
                  ) : (
                    <>
                      {mode === 'video' && (
                        <div className="absolute inset-0 w-full h-full">
                          <video 
                            ref={remoteVideoRef} 
                            autoPlay 
                            playsInline 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      {mode === 'voice' && (
                        <div className="flex flex-col items-center gap-6 relative">
                          <div className="w-32 h-32 rounded-full bg-card border-2 border-accent flex items-center justify-center animate-pulse">
                            <Mic size={48} className="text-accent" />
                          </div>
                          <p className="text-xl font-medium text-white">Voice Call Active</p>
                          <audio ref={remoteAudioRef} autoPlay playsInline />
                        </div>
                      )}
                      
                      {/* Local Video Overlay */}
                      {mode === 'video' && (
                        <div className="absolute bottom-4 right-4 w-24 h-36 md:w-32 md:h-48 bg-gray-900 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl z-10">
                          <video 
                            ref={localVideoRef} 
                            autoPlay 
                            playsInline 
                            muted 
                            className="w-full h-full object-cover"
                          />
                          <button 
                            onClick={toggleMute}
                            className={`absolute bottom-2 right-2 p-1.5 rounded-full ${isMuted ? 'bg-red-500 text-white' : 'bg-white/20 text-white hover:bg-white/40'} backdrop-blur-sm transition-colors`}
                          >
                            {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                          </button>
                        </div>
                      )}
                      
                      {mode === 'voice' && (
                        <div className="absolute bottom-8 flex gap-4">
                          <button 
                            onClick={toggleMute}
                            className={`p-4 rounded-full ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'} transition-all`}
                          >
                            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Chat Area */}
              <div className={`flex flex-col bg-background ${mode === 'text' ? 'w-full max-w-4xl mx-auto' : 'h-[40vh] md:h-auto w-full md:w-[400px] flex-none'} overflow-hidden`}>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4 scroll-smooth">
                  {isSearching && mode === 'text' && (
                    <div className="h-full flex flex-col items-center justify-center text-foreground/40 gap-4">
                      <Loader2 size={32} className="animate-spin text-accent" />
                      <p className="font-mono tracking-widest uppercase text-sm">Looking for someone...</p>
                    </div>
                  )}
                  
                  {isConnected && messages.length === 0 && (
                    <div className="text-center text-foreground/40 my-8 text-sm">
                      You&apos;re now chatting with {partnerName}. Say hi!
                    </div>
                  )}

                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                      {msg.sender === 'stranger' && (
                        <span className="text-xs text-foreground/40 mb-1 ml-1">{partnerName}</span>
                      )}
                      <div className={`max-w-[85%] md:max-w-[80%] rounded-2xl px-3 py-2 md:px-4 md:py-2 ${
                        msg.sender === 'me' 
                          ? 'bg-accent text-white rounded-br-sm' 
                          : 'bg-card text-foreground rounded-bl-sm border border-border'
                      }`}>
                        {msg.imageUrl ? (
                          <div className="relative w-40 h-40 md:w-64 md:h-64 rounded-lg overflow-hidden cursor-pointer" onClick={() => window.open(msg.imageUrl, '_blank')}>
                            <Image 
                              src={msg.imageUrl} 
                              alt="Shared image" 
                              fill 
                              className="object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <span className="break-words text-sm md:text-base">{msg.text}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {partnerTyping && (
                    <div className="flex justify-start">
                      <div className="bg-card text-foreground/40 rounded-2xl rounded-bl-sm px-4 py-2 text-sm flex items-center gap-1 border border-border">
                        <span className="animate-bounce">.</span>
                        <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                        <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>.</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-2 md:p-4 bg-card border-t border-border shrink-0">
                  <form onSubmit={sendMessage} className="flex gap-2 items-center w-full">
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!isConnected || isUploading}
                      className="text-foreground/40 hover:text-foreground p-2 rounded-lg hover:bg-foreground/5 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {isUploading ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
                    </button>
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => {
                        setInputMessage(e.target.value);
                        handleTyping(e.target.value.length > 0);
                      }}
                      onBlur={() => handleTyping(false)}
                      disabled={!isConnected}
                      placeholder={isConnected ? "Message..." : "Waiting..."}
                      className="flex-1 bg-background border border-border rounded-xl px-3 py-2 md:px-4 md:py-3 text-sm md:text-base focus:outline-none focus:border-accent transition-colors disabled:opacity-50 min-w-0"
                    />
                    <button 
                      type="submit"
                      disabled={!isConnected || !inputMessage.trim()}
                      className="bg-accent text-white rounded-xl px-4 py-2 md:px-6 md:py-3 text-sm md:text-base font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:hover:bg-accent shrink-0"
                    >
                      Send
                    </button>
                  </form>

                  {/* Controls */}
                  <div className="flex justify-between items-center mt-3 md:mt-4 gap-2">
                    <button 
                      onClick={endChat}
                      className="flex items-center gap-1 md:gap-2 text-foreground/40 hover:text-foreground transition-colors px-2 py-1.5 md:px-3 md:py-2 rounded-lg hover:bg-foreground/5 text-xs md:text-sm font-medium"
                    >
                      <XCircle size={16} className="md:w-[18px] md:h-[18px]" />
                      Stop
                    </button>
                    
                    {(mode === 'video' || mode === 'voice') && (
                      <button 
                        onClick={toggleMute}
                        className={`flex items-center gap-1 md:gap-2 px-2 py-1.5 md:px-3 md:py-2 rounded-lg text-xs md:text-sm font-medium transition-colors ${isMuted ? 'text-red-400 hover:text-red-300 bg-red-400/10' : 'text-foreground/40 hover:text-foreground hover:bg-foreground/5'}`}
                      >
                        {isMuted ? <MicOff size={16} className="md:w-[18px] md:h-[18px]" /> : <Mic size={16} className="md:w-[18px] md:h-[18px]" />}
                        {isMuted ? 'Unmute' : 'Mute'}
                      </button>
                    )}

                    <button 
                      onClick={skipChat}
                      className="flex items-center gap-1 md:gap-2 bg-foreground text-background px-4 py-1.5 md:px-6 md:py-2 rounded-lg hover:bg-foreground/90 transition-colors font-bold text-xs md:text-sm"
                    >
                      Next
                      <SkipForward size={16} className="md:w-[18px] md:h-[18px]" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
        user={user}
        onSuccess={() => {
          // Refresh user data
          if (supabase) {
            supabase.auth.getSession().then(({ data: { session } }) => {
              setUser(session?.user ?? null);
            });
          }
        }}
      />
    </main>
  );
}
