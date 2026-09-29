# Motion Arcade

Two-player Motion Pong with phones as controllers. The computer shows the game, while phones join by QR code and control separate paddles.

## Local development

```bash
npm install
npm run dev
```

Open the Vite URL on the computer. For phone sensor testing, use a public HTTPS deployment. iPhone motion permission requires HTTPS and a tap on **Enable Motion**. Touch controls work when sensors are unavailable.

## Deploy

This repository has a Vercel configuration for the React frontend. The Socket.IO game server in `server/index.ts` is a continuously running Node process and **must also be deployed** to a host that supports persistent WebSocket connections. Run `npm run build && npm start` on that host. It serves the built frontend too if you prefer a single Node deployment.

For a split deployment, set `VITE_SOCKET_URL=https://your-game-server.example` in Vercel before building the frontend. The QR code uses the Vercel page origin; joined phones connect to the game server via that environment value. Set `CLIENT_ORIGIN=https://your-vercel-domain.example` on the game server so only your frontend origin is allowed by CORS.

Rooms are held in memory. Use one server instance; restart clears active rooms. The server does not yet provide shared state for multiple replicas or Vercel Function instances.

## Current MVP

Host creates a room, two players join by QR or code, calibrate motion or use touch controls, and play Pong to 7 with rematches. Temporary player disconnect pauses the game for a 30-second grace period. Sound, server-side shared state, and keyboard simulation are follow-up work.
