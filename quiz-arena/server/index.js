import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { QUESTIONS } from "./questions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || "http://localhost:5174" },
});

const PORT = Number(process.env.PORT) || 3002;
const QUESTION_SECONDS = 20;
const REVEAL_SECONDS = 5;
const MAX_PLAYERS = 12;
const BOT_THINK_MIN_MS = 1800;
const BOT_THINK_VARIANCE_MS = 1200;
const rooms = new Map();

function cleanName(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 20);
}

function normalizeRoomCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9]{4}$/.test(code) ? code : null;
}

function createRoomCode() {
  return randomBytes(2).toString("hex").toUpperCase();
}

function getSafeQuestion(room) {
  const question = room.questions[room.questionIndex];
  if (!question) return null;
  const safeQuestion = {
    id: question.id,
    category: question.category,
    difficulty: question.difficulty,
    prompt: question.prompt,
    options: question.options,
  };
  if (room.phase === "reveal" || room.phase === "results") {
    safeQuestion.correctIndex = question.correctIndex;
    safeQuestion.explanation = question.explanation;
  }
  return safeQuestion;
}

function publicState(room) {
  const rankedPlayers = [...room.players.values()]
    .map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      answered: player.answered,
      isHost: player.id === room.hostId,
      isBot: Boolean(player.isBot),
      lastCorrect: room.phase === "reveal" || room.phase === "results" ? player.lastCorrect : null,
      pointsEarned: room.phase === "reveal" || room.phase === "results" ? player.pointsEarned : null,
    }))
    .sort((first, second) => second.score - first.score || first.name.localeCompare(second.name));

  return {
    roomCode: room.code,
    phase: room.phase,
    hostId: room.hostId,
    players: rankedPlayers,
    questionNumber: room.phase === "lobby" ? 0 : Math.min(room.questionIndex + 1, room.questions.length),
    questionTotal: room.questions.length,
    question: getSafeQuestion(room),
    endsAt: room.endsAt,
  };
}

function emitState(room) {
  io.to(room.code).emit("room:state", publicState(room));
}

function leaveRoom(socket) {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return;
  const room = rooms.get(roomCode);
  socket.leave(roomCode);
  socket.data.roomCode = null;
  if (!room) return;

  room.players.delete(socket.id);
  if (![...room.players.values()].some((player) => !player.isBot)) {
    rooms.delete(roomCode);
    return;
  }

  if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;
  if (room.phase === "question" && [...room.players.values()].every((player) => player.answered)) {
    revealQuestion(room);
  } else {
    emitState(room);
  }
}

function revealQuestion(room) {
  if (room.phase !== "question") return;
  const question = room.questions[room.questionIndex];
  for (const player of room.players.values()) {
    const answer = room.answers.get(player.id);
    player.lastCorrect = answer?.selectedIndex === question.correctIndex;
    const secondsRemaining = answer ? Math.max(0, Math.ceil((room.endsAt - answer.answeredAt) / 1000)) : 0;
    player.pointsEarned = player.lastCorrect ? 1000 + secondsRemaining * 50 : 0;
    player.score += player.pointsEarned;
  }
  room.phase = "reveal";
  room.endsAt = Date.now() + REVEAL_SECONDS * 1000;
  emitState(room);
}

function nextQuestion(room) {
  room.questionIndex += 1;
  if (room.questionIndex >= room.questions.length) {
    room.phase = "results";
    room.endsAt = null;
    emitState(room);
    return;
  }
  room.phase = "question";
  room.endsAt = Date.now() + QUESTION_SECONDS * 1000;
  room.answers.clear();
  for (const player of room.players.values()) {
    player.answered = false;
    player.lastCorrect = null;
    player.pointsEarned = null;
  }
  scheduleBotAnswer(room);
  emitState(room);
}

function scheduleBotAnswer(room) {
  const hasBot = [...room.players.values()].some((player) => player.isBot);
  room.botAnswerAt = hasBot ? Date.now() + BOT_THINK_MIN_MS + Math.random() * BOT_THINK_VARIANCE_MS : null;
}

function answerForBot(room, now) {
  const bot = [...room.players.values()].find((player) => player.isBot && !player.answered);
  if (!bot || room.phase !== "question") return;

  const question = room.questions[room.questionIndex];
  const isCorrect = Math.random() < 0.72;
  let selectedIndex = question.correctIndex;
  if (!isCorrect) {
    selectedIndex = Math.floor(Math.random() * 3);
    if (selectedIndex >= question.correctIndex) selectedIndex += 1;
  }
  bot.answered = true;
  room.answers.set(bot.id, { selectedIndex, answeredAt: now });
  room.botAnswerAt = null;
  if ([...room.players.values()].every((player) => player.answered)) revealQuestion(room);
  else emitState(room);
}

function startGame(room) {
  room.questions = [...QUESTIONS];
  room.questionIndex = 0;
  room.answers.clear();
  for (const player of room.players.values()) {
    player.score = 0;
    player.answered = false;
    player.lastCorrect = null;
    player.pointsEarned = null;
  }
  room.phase = "question";
  room.endsAt = Date.now() + QUESTION_SECONDS * 1000;
  scheduleBotAnswer(room);
  emitState(room);
}

app.get("/api/health", (_request, response) => response.json({ status: "ok", rooms: rooms.size }));

io.on("connection", (socket) => {
  socket.on("room:create", (payload = {}) => {
    const name = cleanName(payload.name);
    if (!name) {
      socket.emit("room:error", "Enter a display name to create a room.");
      return;
    }

    leaveRoom(socket);
    let code = createRoomCode();
    while (rooms.has(code)) code = createRoomCode();
    const room = {
      code,
      phase: "lobby",
      hostId: socket.id,
      players: new Map([[socket.id, {
        id: socket.id,
        name,
        score: 0,
        answered: false,
        lastCorrect: null,
        pointsEarned: null,
        isBot: false,
      }]]),
      questions: [],
      questionIndex: -1,
      answers: new Map(),
      endsAt: null,
    };
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit("room:state", publicState(room));
  });

  socket.on("room:join", (payload = {}) => {
    const name = cleanName(payload.name);
    const code = normalizeRoomCode(payload.roomCode);
    const room = code && rooms.get(code);
    if (!name || !room) {
      socket.emit("room:error", "That room code wasn't found. Check it and try again.");
      return;
    }
    if (room.phase !== "lobby") {
      socket.emit("room:error", "This quiz is already in progress.");
      return;
    }
    if (room.players.size >= MAX_PLAYERS) {
      socket.emit("room:error", "This room is full. Try another round later.");
      return;
    }

    leaveRoom(socket);
    room.players.set(socket.id, {
      id: socket.id,
      name,
      score: 0,
      answered: false,
      lastCorrect: null,
      pointsEarned: null,
      isBot: false,
    });
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit("room:state", publicState(room));
    emitState(room);
  });

  socket.on("game:start", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== "lobby" || room.hostId !== socket.id || room.players.size < 2) return;
    startGame(room);
  });

  socket.on("game:solo", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== "lobby" || room.hostId !== socket.id || room.players.size !== 1) return;
    const botId = `bot:${room.code}`;
    room.players.set(botId, {
      id: botId,
      name: "QuizBot",
      score: 0,
      answered: false,
      lastCorrect: null,
      pointsEarned: null,
      isBot: true,
    });
    startGame(room);
  });

  socket.on("game:answer", (selectedIndex) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.get(socket.id);
    if (!room || !player || room.phase !== "question" || player.answered) return;
    if (Date.now() >= room.endsAt) {
      revealQuestion(room);
      return;
    }
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) return;

    player.answered = true;
    room.answers.set(socket.id, { selectedIndex, answeredAt: Date.now() });
    if ([...room.players.values()].every((roomPlayer) => roomPlayer.answered)) revealQuestion(room);
    else emitState(room);
  });

  socket.on("disconnect", () => leaveRoom(socket));
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.phase === "question" && room.endsAt <= now) revealQuestion(room);
    else if (room.phase === "question" && room.botAnswerAt && room.botAnswerAt <= now) answerForBot(room, now);
    else if (room.phase === "reveal" && room.endsAt <= now) nextQuestion(room);
  }
}, 250).unref();

const frontendDist = path.resolve(__dirname, "../dist");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_request, response) => response.sendFile(path.join(frontendDist, "index.html")));
}

httpServer.listen(PORT, () => console.log(`Quiz Arena server listening on http://localhost:${PORT}`));