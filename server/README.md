# Study Hall

A realtime study room where people can see who is online, send live messages, and share a Pomodoro timer.

## Features

- Room-code-based join flow and live presence.
- Shared chat with bounded message history.
- Server-authoritative focus and break timer, synchronized to every room member.
- Responsive React interface and Express health endpoint.

## Run

From the repository root:

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. Run `npm test` and `npm run build` from the repository root to verify the app.

## Notes

Room data is in memory and is cleared when a room empties or the server restarts. This is a portfolio/demo implementation, not a production service with durable chat history or accounts.