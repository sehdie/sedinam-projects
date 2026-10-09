# Sedinam Amuzu

**Product-minded Front-End Developer · UI/UX Designer**

I build clear, responsive interfaces and the real-time systems behind them. My work brings product thinking, interaction design, and practical software engineering together, with a focus on accessibility and maintainable front-end architecture.

## Selected Projects

| Project | What it is | What it demonstrates |
| --- | --- | --- |
| [Study Hall](./src/App.jsx) | A shared study room with live presence, chat, and a synchronized Pomodoro timer. | React, Express, Socket.IO, real-time state |
| [Quiz Arena](./quiz-arena/) | A multiplayer trivia room with timed rounds, scoring, a leaderboard, and solo play against QuizBot. | Server-authoritative gameplay, WebSockets, React state |
| [Collaborative Kanban](./collaborative-kanban/) | A live task board with drag-and-drop, task editing, filters, and persistent updates. | Express, Socket.IO, validation, persistence, responsive UI |

## Run Locally

Each project is self-contained and has its own dependencies.

```powershell
npm install
npm run dev
```

The root command starts Study Hall. Open a separate terminal at the repository root for each other app:

```powershell
cd .\quiz-arena
npm install
npm run dev
```

```powershell
cd .\collaborative-kanban
npm install
npm run dev
```

## Deploy

The repository includes a Render Blueprint in [`render.yaml`](./render.yaml). In Render, choose **New → Blueprint**, connect `sehdie/study-hall`, and review the three services before applying the Blueprint.

All three services use Render's free web-service plan. Free services may sleep while idle. Study Hall and Quiz Arena keep room state in memory; Kanban stores tasks in its local JSON file, which is ephemeral on Render and may reset after a restart or redeploy. Use sample data only unless you connect durable storage.

See each project README for deployment-specific behavior and limitations.

## About

- **Focus:** user-centred design, responsive interfaces, design systems, accessibility
- **Tools:** Figma, React, JavaScript, HTML, CSS/SCSS, Node.js, Express, Socket.IO, Python
- **Background:** Computer Science graduate; design and development

More about me: [GitHub profile](https://github.com/sehdie)

Profile README draft: [profile-readme/README.md](./profile-readme/README.md)