import { io, Socket } from 'socket.io-client';

export type ChatMode = 'text' | 'video' | 'voice';

export class SocketMatchmaker {
  private socket: Socket;
  private userId: string;
  private username: string;
  private country: string;
  private gender: string;
  private mode: ChatMode;
  private onMatch: (roomId: string, partnerId: string, partnerName: string, partnerCountry: string, partnerGender: string, isInitiator: boolean, socket: Socket) => void;
  private onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected', queueCount?: number) => void;

  constructor(
    userId: string,
    username: string,
    country: string,
    gender: string,
    mode: ChatMode,
    onMatch: (roomId: string, partnerId: string, partnerName: string, partnerCountry: string, partnerGender: string, isInitiator: boolean, socket: Socket) => void,
    onStatusChange?: (status: 'disconnected' | 'connecting' | 'connected', queueCount?: number) => void
  ) {
    this.userId = userId;
    this.username = username;
    this.country = country;
    this.gender = gender;
    this.mode = mode;
    this.onMatch = onMatch;
    this.onStatusChange = onStatusChange;
    
    console.log('[DEBUG] Initializing SocketMatchmaker for user:', userId);
    
    this.onStatusChange?.('connecting');

    // Connect to the production signaling server
    const socketUrl = "https://catchat-signal.onrender.com";
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      path: '/socket.io/'
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.socket.on('connect', () => {
      console.log('[DEBUG] Socket connected with ID:', this.socket.id);
      this.onStatusChange?.('connected');
      this.socket.emit('join_queue', {
        userId: this.userId,
        username: this.username,
        country: this.country,
        gender: this.gender,
        mode: this.mode
      });
    });

    this.socket.on('queue_status', (data: Record<string, number>) => {
      const count = data[this.mode] || 0;
      this.onStatusChange?.('connected', count);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[DEBUG] Socket connection error:', error);
      this.onStatusChange?.('disconnected');
    });

    this.socket.on('match_found', (data: any) => {
      console.log('[DEBUG] Match found! Room:', data.roomId);
      this.onMatch(
        data.roomId,
        data.partnerId,
        data.partnerName,
        data.partnerCountry,
        data.partnerGender,
        data.isInitiator,
        this.socket
      );
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[DEBUG] Socket disconnected. Reason:', reason);
      this.onStatusChange?.('disconnected');
    });
  }

  async start() {
    if (this.socket.connected) {
      console.log('[DEBUG] Socket already connected, joining queue...');
      this.socket.emit('join_queue', {
        userId: this.userId,
        username: this.username,
        country: this.country,
        gender: this.gender,
        mode: this.mode
      });
    } else {
      console.log('[DEBUG] Socket not connected, waiting for connect event...');
      this.socket.connect();
    }
  }

  cleanupListeners() {
    console.log('[DEBUG] Cleaning up SocketMatchmaker listeners');
    this.socket.off('connect');
    this.socket.off('connect_error');
    this.socket.off('match_found');
    this.socket.off('disconnect');
  }

  skip() {
    console.log('[DEBUG] Skipping current match');
    this.socket.emit('skip');
  }

  stop() {
    console.log('[DEBUG] Stopping SocketMatchmaker');
    this.socket.emit('leave_queue');
    this.cleanupListeners();
    this.socket.disconnect();
  }
}

export class SocketRoom {
  private socket: Socket;
  private roomId: string;
  private myUserId: string;
  private onMessage: (message: string, imageUrl?: string) => void;
  private onPartnerJoined: () => void;
  private onPartnerLeft: () => void;
  private onTyping: (isTyping: boolean) => void;
  private onReady: () => void;

  constructor(
    roomId: string,
    myUserId: string,
    myCountry: string,
    myGender: string,
    socket: Socket,
    callbacks: {
      onMessage: (message: string, imageUrl?: string) => void;
      onPartnerJoined: () => void;
      onPartnerLeft: () => void;
      onTyping: (isTyping: boolean) => void;
      onReady: () => void;
    }
  ) {
    this.roomId = roomId;
    this.myUserId = myUserId;
    this.socket = socket;
    this.onMessage = callbacks.onMessage;
    this.onPartnerJoined = callbacks.onPartnerJoined;
    this.onPartnerLeft = callbacks.onPartnerLeft;
    this.onTyping = callbacks.onTyping;
    this.onReady = callbacks.onReady;

    console.log('[DEBUG] Initializing SocketRoom for room:', roomId);
    this.setupListeners();
  }

  private setupListeners() {
    // Remove any existing listeners for these events to avoid duplicates
    this.socket.off('receive_message');
    this.socket.off('partner_typing');
    this.socket.off('webrtc_signal');
    this.socket.off('partner_left');

    this.socket.on('receive_message', (data: any) => {
      this.onMessage(data.text, data.imageUrl);
    });

    this.socket.on('partner_typing', (data: any) => {
      this.onTyping(data.isTyping);
    });

    this.socket.on('webrtc_signal', (data: any) => {
      const { signal } = data;
      if (signal.type === 'ready') {
        this.onReady();
      }
    });

    this.socket.on('partner_left', () => {
      console.log('[DEBUG] Partner left room:', this.roomId);
      this.onPartnerLeft();
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      console.log('[DEBUG] SocketRoom started');
      resolve();
    });
  }

  async sendMessage(text: string, imageUrl?: string) {
    this.socket.emit('send_message', { roomId: this.roomId, text, imageUrl });
  }

  async sendTyping(isTyping: boolean) {
    this.socket.emit('typing', { roomId: this.roomId, isTyping });
  }

  async sendReady() {
    this.socket.emit('webrtc_signal', { roomId: this.roomId, signal: { type: 'ready' } });
  }

  leave() {
    console.log('[DEBUG] Leaving SocketRoom');
    this.socket.off('receive_message');
    this.socket.off('partner_typing');
    this.socket.off('webrtc_signal');
    this.socket.off('partner_left');
  }

  stop() {
    console.log('[DEBUG] Stopping SocketRoom');
    this.socket.off('receive_message');
    this.socket.off('partner_typing');
    this.socket.off('webrtc_signal');
    this.socket.off('partner_left');
    this.socket.disconnect();
  }
}
