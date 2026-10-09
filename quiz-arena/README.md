# Quiz Arena

A live trivia room for friends: create a room, share its four-character code, and play timed rounds together. A solo player can compete against QuizBot.

**Live demo:** [quiz-arena-lx99.onrender.com](https://quiz-arena-lx99.onrender.com)

## Features

- Live lobby and player roster over Socket.IO.
- Eight random questions per session from a 40-question bank, without repeats until the bank is exhausted.
- Correct answers score more when submitted quickly; the server validates and scores answers.
- Answer keys stay hidden until the reveal phase.
- QuizBot joins as a server-managed competitor in solo mode.
- Live leaderboard, answer reveal, and final results screen.

## Run

```powershell
cd .\quiz-arena
npm install
npm run dev
```

Open the Vite URL printed in the terminal. Use two tabs to try multiplayer, or select **Play solo vs. QuizBot** in a one-player room.

```powershell
npm test
npm run build
```

## Notes

Rooms and scores are in memory and reset when the room empties or the server restarts. Used-question history is saved in `server/data/question-history.json` and prevents repeats across sessions until the bank cycles. Render's free filesystem is ephemeral, so a service restart there resets this history. Display names are not authenticated. This is a portfolio/demo project, not a ranked or production quiz service.

## Deploy

Quiz Arena is included in the repository's Render Blueprint. Deploy from the repository root to create its Node web service; the service builds the Vite app and serves it alongside Socket.IO.