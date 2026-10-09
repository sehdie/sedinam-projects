import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || process.env.RENDER_EXTERNAL_URL || "http://localhost:5173" },
});

const PORT = Number(process.env.PORT) || 3001;
const MAX_MESSAGES = 80;
const durations = { focus: 25 * 60, shortBreak: 5 * 60, longBreak: 15 * 60 };
const rooms = new Map();

function createRoom(id) {
  return {
    id,
    members: new Map(),
    messages: [],
    timer: {
      mode: "focus",
      remaining: durations.focus,
      status: "idle",
      endsAt: null,
      completedSessions: 0,
    },
  };
}

function publicMembers(room) {
  return [...room.members.values()];
}

function publicTimer(room) {
  const timer = room.timer;
  return {
    mode: timer.mode,
    remaining: timer.status === "running"
      ? Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000))
      : timer.remaining,
    status: timer.status,
    completedSessions: timer.completedSessions,
  };
}

function publicRoom(room) {
  return {
    roomId: room.id,
    members: publicMembers(room),
    messages: room.messages,
    timer: publicTimer(room),
  };
}

function validRoomId(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-z0-9_-]{2,32}$/.test(normalized) ? normalized : null;
}

function cleanName(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 24);
}

function emitPresence(room) {
  io.to(room.id).emit("room:presence", publicMembers(room));
}

function emitTimer(room) {
  io.to(room.id).emit("room:timer", publicTimer(room));
}

function leaveRoom(socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;

  const room = rooms.get(roomId);
  socket.leave(roomId);
  socket.data.roomId = null;
  if (!room) return;

  room.members.delete(socket.id);
  if (room.members.size === 0) {
    rooms.delete(roomId);
    return;
  }
  emitPresence(room);
}

function advanceTimer(room) {
  const timer = room.timer;
  if (timer.mode === "focus") {
    timer.completedSessions += 1;
    timer.mode = timer.completedSessions % 4 === 0 ? "longBreak" : "shortBreak";
  } else {
    timer.mode = "focus";
  }
  timer.remaining = durations[timer.mode];
  timer.status = "idle";
  timer.endsAt = null;
}

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", rooms: rooms.size });
});

io.on("connection", (socket) => {
  socket.on("room:join", (payload = {}) => {
    const roomId = validRoomId(payload.roomId);
    const name = cleanName(payload.name);
    if (!roomId || !name) {
      socket.emit("room:error", "Enter a name and a room code (2-32 letters, numbers, _ or -).");
      return;
    }

    leaveRoom(socket);
    let room = rooms.get(roomId);
    if (!room) {
      room = createRoom(roomId);
      rooms.set(roomId, room);
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    room.members.set(socket.id, {
      id: socket.id,
      name,
      color: ["#e5785d", "#709b76", "#d1a643", "#6f8fc1", "#b77b9a"][room.members.size % 5],
    });
    socket.emit("room:state", publicRoom(room));
    emitPresence(room);
  });

  socket.on("room:message", (value) => {
    const room = rooms.get(socket.data.roomId);
    const member = room?.members.get(socket.id);
    const text = String(value || "").trim().slice(0, 500);
    if (!room || !member || !text) return;

    const message = {
      id: randomUUID(),
      senderId: socket.id,
      name: member.name,
      color: member.color,
      text,
      createdAt: Date.now(),
    };
    room.messages.push(message);
    if (room.messages.length > MAX_MESSAGES) room.messages.shift();
    io.to(room.id).emit("room:message", message);
  });

  socket.on("timer:command", (payload = {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    const timer = room.timer;

    if (payload.action === "start" && timer.status !== "running") {
      timer.status = "running";
      timer.endsAt = Date.now() + timer.remaining * 1000;
    } else if (payload.action === "pause" && timer.status === "running") {
      timer.remaining = Math.max(0, Math.ceil((timer.endsAt - Date.now()) / 1000));
      timer.status = "paused";
      timer.endsAt = null;
    } else if (payload.action === "reset") {
      timer.status = "idle";
      timer.remaining = durations[timer.mode];
      timer.endsAt = null;
    } else if (payload.action === "skip") {
      advanceTimer(room);
    } else if (payload.action === "select" && durations[payload.mode] && timer.status !== "running") {
      timer.mode = payload.mode;
      timer.remaining = durations[payload.mode];
      timer.status = "idle";
      timer.endsAt = null;
    } else {
      return;
    }
    emitTimer(room);
  });

  socket.on("disconnect", () => leaveRoom(socket));
});

setInterval(() => {
  for (const room of rooms.values()) {
    const timer = room.timer;
    if (timer.status !== "running") continue;
    if (timer.endsAt <= Date.now()) advanceTimer(room);
    emitTimer(room);
  }
}, 1000).unref();

const frontendDist = path.resolve(__dirname, "../dist");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_request, response) => response.sendFile(path.join(frontendDist, "index.html")));
}

httpServer.listen(PORT, () => {
  console.log(`Study Hall server listening on http://localhost:${PORT}`);
});