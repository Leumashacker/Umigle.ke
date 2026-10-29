# Umigle KE

Random 1-on-1 video + text chat (WebRTC + Socket.io + Express).

## Run

```bash
npm install
npm start        # http://localhost:3000
```

Camera/mic need HTTPS in production (localhost is fine for testing).

## Environment variables

| Name | Purpose |
|------|---------|
| `PORT` | Port to listen on (set automatically by Render/Railway/Heroku) |
| `TURN_URL` | TURN server URL(s), comma separated, e.g. `turn:global.relay.metered.ca:80,turn:global.relay.metered.ca:443?transport=tcp` |
| `TURN_USERNAME` | TURN username |
| `TURN_CREDENTIAL` | TURN password |
| `CORS_ORIGIN` | Allowed origin for sockets (default `*`) |

Without a TURN server, some users on mobile networks will not be able to connect to each other. A free TURN account (e.g. Metered Open Relay) is enough to start.

## Moderation

Users must confirm they are 18+ and can press **Report**; reports are logged on the server (`REPORT:` lines). Add real moderation before a public launch.
