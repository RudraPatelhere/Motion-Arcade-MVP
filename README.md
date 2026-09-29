# Motion Arcade

Two-player Motion Pong with phones as controllers. The computer shows the game, while phones join by QR code and control separate paddles.

## Local development

```bash
npm install
npm run dev
```

Open the Vite URL on the computer. For phone sensor testing, use a public HTTPS deployment. iPhone motion permission requires HTTPS and a tap on **Enable Motion**. Touch controls work when sensors are unavailable.

## Deploy

### Render (one playable link)

Create a **Web Service** connected to this GitHub repository. Select **Node** and the **Free** compute plan, with the repository root as the root directory. Use:

- Build Command: `npm ci --include=dev && npm run build`
- Start Command: `npm start`
- Health Check Path: `/health`

The server serves the built game and Socket.IO on the same HTTPS URL. No environment variables are required for this single-service deployment. Keep one instance because rooms are stored in memory. A free service sleeps when idle, so the first visit may take a while to load.

### Separate frontend on Vercel (optional)

This repository has a Vercel configuration for the React frontend. The Socket.IO game server in `server/index.ts` is a continuously running Node process and **must also be deployed** to a host that supports persistent WebSocket connections. Run `npm run build && npm start` on that host. It serves the built frontend too if you prefer a single Node deployment.

For a split deployment, set `VITE_SOCKET_URL=https://your-game-server.example` in Vercel before building the frontend. The QR code uses the Vercel page origin; joined phones connect to the game server via that environment value. Set `CLIENT_ORIGIN=https://your-vercel-domain.example` on the game server so only your frontend origin is allowed by CORS.

Rooms are held in memory. Use one server instance; restart clears active rooms. The server does not yet provide shared state for multiple replicas or Vercel Function instances.

## Current MVP

Host chooses Motion Pong or Neon Maze, creates a room, and two players join by QR or code. Phones calibrate motion or use touch controls. Pong plays to 7; in Maze, both players race through the same generated course to the exit. Rematches generate a fresh maze. Temporary player disconnect pauses the game for a 30-second grace period. Match history, server-side shared state, and keyboard simulation are follow-up work.
