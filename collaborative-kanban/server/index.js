import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || process.env.RENDER_EXTERNAL_URL || "http://localhost:5175" },
});

const PORT = Number(process.env.PORT) || 3003;
const BOARD_ID = "product-launch";
const BOARD_TITLE = "Product launch";
const BOARD_ROOM = `board:${BOARD_ID}`;
const COLUMN_IDS = ["backlog", "inProgress", "review", "done"];
const PRIORITY_IDS = ["urgent", "high", "normal", "low"];
const DATA_PATH = process.env.BOARD_DATA_PATH || path.join(__dirname, "data", "boards.json");

const TEAM = [
  { id: "maya", name: "Maya Chen", initials: "MC", color: "#df7555" },
  { id: "leo", name: "Leo Martins", initials: "LM", color: "#658ca0" },
  { id: "imani", name: "Imani Reed", initials: "IR", color: "#839751" },
  { id: "noah", name: "Noah Kim", initials: "NK", color: "#b27899" },
  { id: "you", name: "You", initials: "YO", color: "#d0a548" },
];

const seededTasks = [
  { id: "task-01", title: "Map the first-run experience", description: "Walk through the first session and note every point where a new account needs context.", status: "backlog", priority: "high", assigneeId: "maya", dueDate: "2026-10-14", tags: ["Discovery", "Onboarding"], createdAt: "2026-10-02T09:00:00.000Z", updatedAt: "2026-10-02T09:00:00.000Z" },
  { id: "task-02", title: "Confirm launch checklist with support", description: "Collect the support handoff requirements and document the escalation path.", status: "backlog", priority: "normal", assigneeId: "imani", dueDate: "2026-10-16", tags: ["Launch"], createdAt: "2026-10-02T11:00:00.000Z", updatedAt: "2026-10-02T11:00:00.000Z" },
  { id: "task-03", title: "Audit empty and error states", description: "Make sure the key screens have a useful next step when things go wrong.", status: "backlog", priority: "low", assigneeId: "noah", dueDate: "2026-10-19", tags: ["Quality"], createdAt: "2026-10-03T08:15:00.000Z", updatedAt: "2026-10-03T08:15:00.000Z" },
  { id: "task-04", title: "Build invite flow", description: "Invite teammates from the workspace menu and show pending invitations.", status: "inProgress", priority: "urgent", assigneeId: "leo", dueDate: "2026-10-11", tags: ["Core", "Collaboration"], createdAt: "2026-10-01T08:00:00.000Z", updatedAt: "2026-10-08T10:00:00.000Z" },
  { id: "task-05", title: "Design project overview", description: "A compact landing view with clear owners, dates, and recent progress.", status: "inProgress", priority: "high", assigneeId: "maya", dueDate: "2026-10-13", tags: ["Design"], createdAt: "2026-10-01T09:20:00.000Z", updatedAt: "2026-10-08T08:00:00.000Z" },
  { id: "task-06", title: "Instrument activation events", description: "Track workspace created, teammate invited, and first task completed.", status: "inProgress", priority: "normal", assigneeId: "you", dueDate: "2026-10-15", tags: ["Analytics"], createdAt: "2026-10-04T13:40:00.000Z", updatedAt: "2026-10-07T14:00:00.000Z" },
  { id: "task-07", title: "Write keyboard shortcut guide", description: "Document the shortcuts that are available in the board interface.", status: "review", priority: "normal", assigneeId: "noah", dueDate: "2026-10-12", tags: ["Docs"], createdAt: "2026-10-03T10:00:00.000Z", updatedAt: "2026-10-08T09:15:00.000Z" },
  { id: "task-08", title: "Review mobile board layout", description: "Check the narrow-screen experience for filters, cards, and the task dialog.", status: "review", priority: "high", assigneeId: "imani", dueDate: "2026-10-12", tags: ["Responsive", "Design"], createdAt: "2026-10-05T11:30:00.000Z", updatedAt: "2026-10-08T11:00:00.000Z" },
  { id: "task-09", title: "Set up design tokens", description: "Create color, spacing, and type tokens for the shared interface.", status: "done", priority: "normal", assigneeId: "maya", dueDate: "2026-10-06", tags: ["Foundation"], createdAt: "2026-09-28T09:00:00.000Z", updatedAt: "2026-10-06T16:00:00.000Z" },
  { id: "task-10", title: "Create launch announcement draft", description: "Draft a short product update for the early-access mailing list.", status: "done", priority: "low", assigneeId: "you", dueDate: "2026-10-07", tags: ["Launch", "Comms"], createdAt: "2026-09-30T15:15:00.000Z", updatedAt: "2026-10-07T13:30:00.000Z" },
];

function loadTasks() {
  if (!existsSync(DATA_PATH)) return seededTasks.map((task) => ({ ...task, tags: [...task.tags] }));
  const stored = JSON.parse(readFileSync(DATA_PATH, "utf8"));
  if (!Array.isArray(stored.tasks)) throw new Error("Kanban data file is missing its task list.");
  return stored.tasks;
}

let tasks = loadTasks();
const members = new Map();

function persistTasks() {
  mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  const tempPath = `${DATA_PATH}.tmp`;
  writeFileSync(tempPath, JSON.stringify({ tasks }, null, 2), "utf8");
  renameSync(tempPath, DATA_PATH);
}

function safeMember(member) {
  return { id: member.id, name: member.name, initials: member.initials, color: member.color };
}

function publicBoard() {
  return {
    id: BOARD_ID,
    title: BOARD_TITLE,
    columns: [
      { id: "backlog", label: "To do", tone: "slate" },
      { id: "inProgress", label: "In progress", tone: "blue" },
      { id: "review", label: "In review", tone: "amber" },
      { id: "done", label: "Done", tone: "green" },
    ],
    tasks,
    team: TEAM,
    members: TEAM,
  };
}

function emitBoard() {
  io.to(BOARD_ROOM).emit("board:state", publicBoard());
}

function emitPresence() {
  io.to(BOARD_ROOM).emit("board:presence", [...members.values()].map(safeMember));
}

function cleanText(value, maxLength) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}

function sendError(socket, message) {
  socket.emit("board:error", message);
}

function validatePatch(patch) {
  const allowedKeys = new Set(["title", "description", "status", "priority", "assigneeId", "dueDate", "tags"]);
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) return null;
  if (Object.keys(patch).some((key) => !allowedKeys.has(key))) return null;

  const validated = {};
  if ("title" in patch) {
    validated.title = cleanText(patch.title, 100);
    if (!validated.title) return null;
  }
  if ("description" in patch) {
    validated.description = cleanText(patch.description, 1000);
  }
  if ("status" in patch) {
    if (!COLUMN_IDS.includes(patch.status)) return null;
    validated.status = patch.status;
  }
  if ("priority" in patch) {
    if (!PRIORITY_IDS.includes(patch.priority)) return null;
    validated.priority = patch.priority;
  }
  if ("assigneeId" in patch) {
    if (patch.assigneeId !== null && !TEAM.some((member) => member.id === patch.assigneeId)) return null;
    validated.assigneeId = patch.assigneeId;
  }
  if ("dueDate" in patch) {
    if (patch.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(patch.dueDate)) return null;
    validated.dueDate = patch.dueDate || "";
  }
  if ("tags" in patch) {
    if (!Array.isArray(patch.tags) || patch.tags.length > 4) return null;
    validated.tags = patch.tags.map((tag) => cleanText(tag, 22)).filter(Boolean);
  }
  return Object.keys(validated).length ? validated : null;
}

function updateTask(socket, taskId, patch) {
  if (!members.has(socket.id)) return;
  const task = tasks.find((item) => item.id === taskId);
  const changes = validatePatch(patch);
  if (!task || !changes) {
    sendError(socket, "That task update could not be applied.");
    return;
  }
  Object.assign(task, changes, { updatedAt: new Date().toISOString() });
  persistTasks();
  emitBoard();
}

app.get("/api/health", (_request, response) => response.json({ status: "ok", tasks: tasks.length }));
app.get("/api/board", (_request, response) => response.json(publicBoard()));

const frontendDist = path.resolve(__dirname, "../dist");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_request, response) => response.sendFile(path.join(frontendDist, "index.html")));
}

io.on("connection", (socket) => {
  socket.on("board:join", (payload = {}) => {
    const name = cleanText(payload.name, 24);
    if (!name) {
      sendError(socket, "Add your name to join the workspace.");
      return;
    }

    const previousRoom = socket.data.boardRoom;
    if (previousRoom) {
      socket.leave(previousRoom);
      members.delete(socket.id);
      emitPresence();
    }

    const color = TEAM[Math.abs([...name].reduce((sum, character) => sum + character.charCodeAt(0), 0)) % TEAM.length].color;
    members.set(socket.id, {
      id: socket.id,
      name,
      initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
      color,
    });
    socket.join(BOARD_ROOM);
    socket.data.boardRoom = BOARD_ROOM;
    socket.emit("board:state", publicBoard());
    emitPresence();
  });

  socket.on("task:create", (payload = {}) => {
    if (!members.has(socket.id)) return;
    const changes = validatePatch({
      title: payload.title,
      description: payload.description || "",
      status: payload.status || "backlog",
      priority: payload.priority || "normal",
      assigneeId: payload.assigneeId || null,
      dueDate: payload.dueDate || "",
      tags: payload.tags || [],
    });
    if (!changes) {
      sendError(socket, "Add a title and choose valid task details.");
      return;
    }

    const timestamp = new Date().toISOString();
    tasks.unshift({
      id: randomUUID(),
      ...changes,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: members.get(socket.id).name,
    });
    persistTasks();
    emitBoard();
  });

  socket.on("task:update", (payload = {}) => updateTask(socket, payload.id, payload.patch));
  socket.on("task:move", (payload = {}) => updateTask(socket, payload.id, { status: payload.status }));

  socket.on("task:delete", (taskId) => {
    if (!members.has(socket.id)) return;
    const taskIndex = tasks.findIndex((task) => task.id === taskId);
    if (taskIndex < 0) return;
    tasks.splice(taskIndex, 1);
    persistTasks();
    emitBoard();
  });

  socket.on("disconnect", () => {
    if (!socket.data.boardRoom) return;
    members.delete(socket.id);
    emitPresence();
  });
});

httpServer.listen(PORT, process.env.HOST || "0.0.0.0", () => console.log(`Collaborative Kanban server listening on http://localhost:${PORT}`));