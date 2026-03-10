import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';
import { RealtimeChannel } from '@supabase/supabase-js';

export type ChatMode = 'text' | 'video' | 'voice';

export interface MatchState {
  userId: string;
  username: string;
  country?: string;
  gender?: string;
  mode: ChatMode;
  status: 'ACTIVE' | 'MATCHED';
  joinedAt: number;
}

export class RealtimeMatchmaker {
  private channel: RealtimeChannel | null = null;
  private myUserId: string;
  private myUsername: string;
  private myCountry: string;
  private myGender: string;
  private mode: ChatMode;
  private onMatch: (roomId: string, partnerId: string, partnerName: string, partnerCountry: string, partnerGender: string, isInitiator: boolean) => void;
  private joinedAt: number;
  private lastMatchedPartnerId: string | null = null;

  constructor(
    userId: string,
    username: string,
    country: string,
    gender: string,
    mode: ChatMode,
    onMatch: (roomId: string, partnerId: string, partnerName: string, partnerCountry: string, partnerGender: string, isInitiator: boolean) => void
  ) {
    this.myUserId = userId;
    this.myUsername = username;
    this.myCountry = country;
    this.myGender = gender;
    this.mode = mode;
    this.onMatch = onMatch;
    this.joinedAt = Date.now();
  }

  setLastMatchedPartnerId(partnerId: string | null) {
    this.lastMatchedPartnerId = partnerId;
  }

  async start() {
    if (!supabase) {
      console.error('Supabase client is not initialized');
      return;
    }

    // Strict Auth & Age Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('Matchmaker blocked: User not authenticated');
      return;
    }

    const is18Plus = session.user.user_metadata?.is_18_plus;
    if (!is18Plus) {
      console.error('Matchmaker blocked: User not verified as 18+');
      return;
    }

    this.channel = supabase.channel(`matchmaking:${this.mode}`, {
      config: {
        presence: {
          key: this.myUserId,
        },
      },
    });

    this.channel
      .on('presence', { event: 'sync' }, () => {
        this.checkMatches();
      })
      .on('broadcast', { event: 'invite' }, (payload) => {
        if (payload.payload.to === this.myUserId) {
          this.handleInvite(payload.payload);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel?.track({
            userId: this.myUserId,
            username: this.myUsername,
            country: this.myCountry,
            gender: this.myGender,
            mode: this.mode,
            status: 'ACTIVE',
            joinedAt: this.joinedAt,
          });
        }
      });
  }

  private async checkMatches() {
    if (!this.channel) return;

    const state = this.channel.presenceState();
    const activeUsers: MatchState[] = [];

    for (const key in state) {
      const userState = state[key][0] as unknown as MatchState;
      if (userState && userState.status === 'ACTIVE' && userState.mode === this.mode) {
        activeUsers.push(userState);
      }
    }

    // Sort by joinedAt to ensure deterministic pairing
    activeUsers.sort((a, b) => a.joinedAt - b.joinedAt);

    const myIndex = activeUsers.findIndex((u) => u.userId === this.myUserId);

    if (myIndex !== -1 && myIndex + 1 < activeUsers.length) {
      let partnerIndex = myIndex + 1;
      let partner = activeUsers[partnerIndex];

      // Smart Matchmaking: Avoid immediate rematch if possible
      if (
        this.lastMatchedPartnerId && 
        partner.userId === this.lastMatchedPartnerId && 
        activeUsers.length > 2
      ) {
        // Try to find another partner
        if (partnerIndex + 1 < activeUsers.length) {
          partnerIndex += 1;
          partner = activeUsers[partnerIndex];
        } else if (myIndex > 0) {
           // If I'm not the first one, maybe the one before me is available and not my last match?
           // But the logic here assumes pairing (0-1, 2-3). 
           // If we skip, we might break the chain.
           // Simple strategy: If the immediate next is the last match, and there is a subsequent one, swap.
        }
      }
      
      // Re-check index parity after potential swap logic or just stick to simple next available
      // Ideally, we want to be the initiator if we are the "older" user in the pair.
      // Let's refine: We iterate through the sorted list.
      // If I am at index i, and i is even, I try to pair with i+1.
      
      if (myIndex % 2 === 0) {
         partner = activeUsers[myIndex + 1];
         
         // If partner is last matched and we have another option
         if (partner.userId === this.lastMatchedPartnerId && activeUsers.length > 2) {
             // Look for a swap. 
             // If there is a third user (index + 2), we could try to pair with them, 
             // but that leaves the middle one stranded or forces them to pair with someone else.
             // For simplicity and robustness in a distributed system without a central authority,
             // we stick to a deterministic rule:
             // If I am even index, I pair with odd index.
             // If that pair is undesirable, we can only skip if we are sure the other person will also skip.
             
             // ALTERNATIVE STRATEGY:
             // Filter out the last matched partner from the candidate list for ME.
             // But this breaks global deterministic pairing if everyone sees a different list.
             
             // CORRECT APPROACH for decentralized:
             // We can't easily guarantee "no rematch" without a central server or complex negotiation.
             // However, we can try a probabilistic approach or just accept the fallback if only 2 people.
             
             // Let's implement the requested logic: "If 3 or more users are available, match with different user."
             // We can achieve this by locally deciding to SKIP the invite if it's the last partner, 
             // AND waiting for a different match. But if we are the initiator, we control the invite.
             
             if (activeUsers.length > 2 && partner.userId === this.lastMatchedPartnerId) {
                 // Try next candidate if available
                 if (myIndex + 2 < activeUsers.length) {
                     partner = activeUsers[myIndex + 2];
                 } else {
                     // No next candidate, maybe previous? But we are even index (0, 2, 4).
                     // If we are 0, we check 1. If 1 is bad, check 2? No, 2 is even (initiator).
                     // We need an odd index.
                     // If we are 0, and 1 is bad. We need 3.
                     if (myIndex + 3 < activeUsers.length) {
                         partner = activeUsers[myIndex + 3];
                     }
                 }
             }
         }
         
         // Double check we didn't go out of bounds or pick ourselves
         if (partner && partner.userId !== this.myUserId) {
              const roomId = uuidv4();

              // Update my status to MATCHED
              await this.channel.track({
                userId: this.myUserId,
                username: this.myUsername,
                country: this.myCountry,
                gender: this.myGender,
                mode: this.mode,
                status: 'MATCHED',
                joinedAt: this.joinedAt,
              });

              // Send invite
              await this.channel.send({
                type: 'broadcast',
                event: 'invite',
                payload: {
                  to: partner.userId,
                  roomId,
                  partnerId: this.myUserId,
                  partnerName: this.myUsername,
                  partnerCountry: this.myCountry,
                  partnerGender: this.myGender,
                },
              });

              this.onMatch(roomId, partner.userId, partner.username, partner.country || '', partner.gender || '', true);
         }
      }
    }
  }

  private async handleInvite(payload: any) {
    if (!this.channel) return;

    // Update my status to MATCHED
    await this.channel.track({
      userId: this.myUserId,
      username: this.myUsername,
      country: this.myCountry,
      gender: this.myGender,
      mode: this.mode,
      status: 'MATCHED',
      joinedAt: this.joinedAt,
    });

    this.onMatch(payload.roomId, payload.partnerId, payload.partnerName, payload.partnerCountry || '', payload.partnerGender || '', false);
  }

  stop() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
  }
}

export class RealtimeRoom {
  private channel: RealtimeChannel | null = null;
  private roomId: string;
  private myUserId: string;
  private myCountry: string;
  private myGender: string;
  private onMessage: (message: string, imageUrl?: string) => void;
  private onPartnerJoined: () => void;
  private onPartnerLeft: () => void;
  private onWebRTCOffer: (offer: any) => void;
  private onWebRTCAnswer: (answer: any) => void;
  private onWebRTCIceCandidate: (candidate: any) => void;
  private onTyping: (isTyping: boolean) => void;

  private onReady: () => void;

  constructor(
    roomId: string,
    myUserId: string,
    myCountry: string,
    myGender: string,
    callbacks: {
      onMessage: (message: string, imageUrl?: string) => void;
      onPartnerJoined: () => void;
      onPartnerLeft: () => void;
      onWebRTCOffer: (offer: any) => void;
      onWebRTCAnswer: (answer: any) => void;
      onWebRTCIceCandidate: (candidate: any) => void;
      onTyping: (isTyping: boolean) => void;
      onReady: () => void;
    }
  ) {
    this.roomId = roomId;
    this.myUserId = myUserId;
    this.myCountry = myCountry;
    this.myGender = myGender;
    this.onMessage = callbacks.onMessage;
    this.onPartnerJoined = callbacks.onPartnerJoined;
    this.onPartnerLeft = callbacks.onPartnerLeft;
    this.onWebRTCOffer = callbacks.onWebRTCOffer;
    this.onWebRTCAnswer = callbacks.onWebRTCAnswer;
    this.onWebRTCIceCandidate = callbacks.onWebRTCIceCandidate;
    this.onTyping = callbacks.onTyping;
    this.onReady = callbacks.onReady;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!supabase) {
        console.error('Supabase client is not initialized');
        reject(new Error('Supabase client is not initialized'));
        return;
      }

      this.channel = supabase.channel(`room:${this.roomId}`, {
        config: {
          presence: {
            key: this.myUserId,
          },
        },
      });

      this.channel
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          if (newPresences.some((p) => p.userId !== this.myUserId)) {
            this.onPartnerJoined();
          }
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          if (leftPresences.some((p) => p.userId !== this.myUserId)) {
            this.onPartnerLeft();
          }
        })
        .on('broadcast', { event: 'message' }, (payload) => {
          if (payload.payload.from !== this.myUserId) {
            this.onMessage(payload.payload.text, payload.payload.imageUrl);
          }
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
          if (payload.payload.from !== this.myUserId) {
            this.onTyping(payload.payload.isTyping);
          }
        })
        .on('broadcast', { event: 'ready' }, (payload) => {
          if (payload.payload.from !== this.myUserId) {
            this.onReady();
          }
        })
        .on('broadcast', { event: 'webrtc_offer' }, (payload) => {
          if (payload.payload.from !== this.myUserId) {
            this.onWebRTCOffer(payload.payload.offer);
          }
        })
        .on('broadcast', { event: 'webrtc_answer' }, (payload) => {
          if (payload.payload.from !== this.myUserId) {
            this.onWebRTCAnswer(payload.payload.answer);
          }
        })
        .on('broadcast', { event: 'webrtc_ice_candidate' }, (payload) => {
          if (payload.payload.from !== this.myUserId) {
            this.onWebRTCIceCandidate(payload.payload.candidate);
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await this.channel?.track({ 
              userId: this.myUserId,
              country: this.myCountry,
              gender: this.myGender
            });
            resolve();
          } else if (status === 'CHANNEL_ERROR') {
            reject(new Error('Failed to subscribe to room channel'));
          }
        });
    });
  }

  async sendMessage(text: string, imageUrl?: string) {
    await this.channel?.send({
      type: 'broadcast',
      event: 'message',
      payload: { from: this.myUserId, text, imageUrl },
    });
  }

  async sendTyping(isTyping: boolean) {
    await this.channel?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { from: this.myUserId, isTyping },
    });
  }

  async sendReady() {
    await this.channel?.send({
      type: 'broadcast',
      event: 'ready',
      payload: { from: this.myUserId },
    });
  }

  async sendWebRTCOffer(offer: any) {
    await this.channel?.send({
      type: 'broadcast',
      event: 'webrtc_offer',
      payload: { from: this.myUserId, offer },
    });
  }

  async sendWebRTCAnswer(answer: any) {
    await this.channel?.send({
      type: 'broadcast',
      event: 'webrtc_answer',
      payload: { from: this.myUserId, answer },
    });
  }

  async sendWebRTCIceCandidate(candidate: any) {
    await this.channel?.send({
      type: 'broadcast',
      event: 'webrtc_ice_candidate',
      payload: { from: this.myUserId, candidate },
    });
  }

  stop() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
  }
}
