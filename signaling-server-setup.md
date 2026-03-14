# Signaling Server Setup Guide

This guide explains how to run the CatChat signaling server on your own machine so users from the internet can connect to it.

---

## Prerequisites

- Node.js 18+ installed ([nodejs.org](https://nodejs.org))
- Port 3000 open on your firewall / router

---

## Step 1 — Start the Server

```bash
# From the CatChat project folder:
npm install        # first time only
npm run build      # first time only (builds Next.js)
npm run start      # starts the server
```

You should see:
```
> Ready on http://0.0.0.0:3000
```

The server is now running and accepting connections.

---

## Step 2 — Find Your Public IP

Visit this URL **on the server machine**:

👉 https://whatismyip.com

Note the IP address — for example: `123.45.67.89`

Your signaling server URL will be: `http://123.45.67.89:3000`

---

## Step 3 — Open Port 3000

### On Windows Firewall (Server Machine)

Open PowerShell as Administrator and run:

```powershell
New-NetFirewallRule -DisplayName "CatChat Signaling" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```

### On Your Router (Home Network)

If on a home network, you need to **port-forward** port 3000 to your PC:

1. Open your router admin panel (usually http://192.168.1.1 or http://192.168.0.1)
2. Log in (default credentials are often on a sticker on your router)
3. Find **Port Forwarding** / **NAT** / **Virtual Servers** section
4. Add a new rule:
   - **External Port:** 3000
   - **Internal IP:** Your PC's local IP (find it by running `ipconfig` in Command Prompt — look for `IPv4 Address`)
   - **Internal Port:** 3000
   - **Protocol:** TCP
5. Save and apply

### On a Linux VPS (e.g. Ubuntu)

```bash
sudo ufw allow 3000/tcp
sudo ufw reload
```

---

## Step 4 — Test the Connection

From any browser on a different network, visit:

```
http://YOUR_PUBLIC_IP:3000
```

You should see the CatChat app. If it loads, the server is accessible from the internet.

---

## Step 5 — Keep the Server Running 24/7

### Option A: Simple (Leave Terminal Open)
Just run `npm run start` and leave the terminal window open.

### Option B: Background Process (Windows)

Install PM2 to run the server in the background:

```bash
npm install -g pm2
pm2 start "npm run start" --name catchat
pm2 save
pm2 startup   # makes it survive reboots
```

### Option C: Background Process (Linux/VPS)

```bash
npm install -g pm2
pm2 start "npm run start" --name catchat
pm2 save
pm2 startup systemd  # auto-start on reboot
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Browser can't connect to your IP | Check Windows Firewall rule and router port-forward |
| Works locally but not from internet | Router port-forward is wrong or firewalled by ISP |
| Server crashes | Run `pm2 logs catchat` to see errors |
| Port already in use | Change port: `PORT=4000 npm run start` (update NEXT_PUBLIC_SIGNALING_URL too) |
| Dynamic IP changes | Use a free DDNS service like [no-ip.com](https://noip.com) or [duckdns.org](https://duckdns.org) |

---

## Dynamic IP Problem

Home internet connections usually have a **dynamic IP** that can change. When it changes, users can't connect.

**Free solution:** Use a DDNS (Dynamic DNS) service:

1. Sign up at [duckdns.org](https://duckdns.org) — completely free
2. Create a subdomain (e.g. `catchat-yourname.duckdns.org`)
3. Install their update client on your PC (updates DNS automatically when your IP changes)
4. Set your `NEXT_PUBLIC_SIGNALING_URL` to `http://catchat-yourname.duckdns.org:3000`

Now your domain always points to your current IP — no manual updates needed.
