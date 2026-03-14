# CatChat Deployment Guide

## Architecture (100% Free)

```
Users ──WebSocket──► Self-Hosted Signaling Server (your PC/VPS)
  │                        │
  │                  Matchmaking + Relay
  │
  ├── HTTPS ──► Vercel (Next.js Frontend)
  │
  └── WebRTC P2P ──► Other Users
```

| Component | Where it runs | Cost |
|-----------|--------------|------|
| Frontend  | Vercel       | Free |
| Signaling Server | Your PC / VPS | Free |
| Media (video/voice) | WebRTC P2P | Free |
| Auth + Storage | Supabase | Free tier |

---

## 1. Local Development (No Setup Needed)

```bash
npm install
npm run dev
```

Opens at **http://localhost:3000** — Next.js and Socket.io run together on the same server. No env vars needed.

---

## 2. Production Setup

### Step 1 — Run the Signaling Server on Your Machine

On the machine that will act as your server (home PC, VPS, etc.):

```bash
# Install dependencies (once)
npm install

# Build Next.js (once, or after frontend changes)
npm run build

# Start the combined server (signaling + Next.js)
npm run start
```

> **Keep this terminal running** — the server must stay on 24/7 for users to connect.

Your server listens on port **3000** by default. You can change this with `PORT=8080 npm run start`.

📋 See [`signaling-server-setup.md`](./signaling-server-setup.md) for the full guide on finding your public IP, port-forwarding your router, and firewall rules.

---

### Step 2 — Deploy Frontend to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. In **Project Settings → Environment Variables**, add:

```
NEXT_PUBLIC_SIGNALING_URL = http://YOUR_PUBLIC_IP:3000
NEXT_PUBLIC_SUPABASE_URL  = https://exalqemsksybzschzibp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_n4y-_oseQEu579QpfCzx8w_Ad1ixt7w
```

> Replace `YOUR_PUBLIC_IP` with your actual public IP address.  
> Find it by visiting https://whatismyip.com on the server machine.

4. Deploy — Vercel builds and hosts your frontend for free.

---

### Step 3 — Verify It's Working

1. Open your Vercel URL in a browser
2. Open DevTools → Network → filter by **WS**
3. You should see a WebSocket connection to `ws://YOUR_IP:3000`
4. Open a second browser tab to the same URL
5. Click **Text Chat** in both tabs — they should match each other

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_SIGNALING_URL` | Production only | Your server's public URL, e.g. `http://123.45.67.89:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase project URL (has fallback default) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase anon key (has fallback default) |
| `REDIS_URL` | Optional | For running multiple server instances. Omit for single-server. |
| `PORT` | Optional | Server port. Defaults to `3000`. |

---

## Scaling Beyond a Single Server

If you grow to many concurrent users:

```
Load Balancer
     │
┌────┼────┐
▼    ▼    ▼
Signaling  Signaling  Signaling
Server     Server     Server
     │
  Redis Pub/Sub (sync queues across servers)
```

Redis support is already in `package.json` (`@socket.io/redis-adapter`). Set `REDIS_URL` to enable it.
