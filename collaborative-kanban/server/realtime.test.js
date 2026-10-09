import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once as onceEvent } from "node:events";
import { createServer as createTcpServer } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { io } from "socket.io-client";

function waitForBoard(socket, predicate = () => true, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const onBoard = (board) => {
      if (!predicate(board)) return;
      clearTimeout(timer);
      socket.off("board:state", onBoard);
      resolve(board);
    };
    const timer = setTimeout(() => {
      socket.off("board:state", onBoard);
      reject(new Error("Timed out waiting for the board update."));
    }, timeoutMs);
    socket.on("board:state", onBoard);
  });
}

function waitForPresence(socket, predicate = () => true, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const onPresence = (members) => {
      if (!predicate(members)) return;
      clearTimeout(timer);
      socket.off("board:presence", onPresence);
      resolve(members);
    };
    const timer = setTimeout(() => {
      socket.off("board:presence", onPresence);
      reject(new Error("Timed out waiting for the presence update."));
    }, timeoutMs);
    socket.on("board:presence", onPresence);
  });
}

async function reservePort() {
  const server = createTcpServer();
  server.listen(0, "127.0.0.1");
  await onceEvent(server, "listening");
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

test("task changes persist and synchronize across connected clients", async (context) => {
  const port = await reservePort();
  const dataDirectory = await mkdtemp(path.join(tmpdir(), "collaborative-kanban-"));
  const dataPath = path.join(dataDirectory, "boards.json");
  const serverPath = fileURLToPath(new URL("./index.js", import.meta.url));
  let serverOutput = "";
  let childExit = "still running";
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", BOARD_DATA_PATH: dataPath },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { serverOutput += chunk; });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { serverOutput += chunk; });
  child.on("exit", (code, signal) => { childExit = `exit ${code}, signal ${signal}`; });
  const first = io(`http://127.0.0.1:${port}`, { autoConnect: false, timeout: 3000 });
  const second = io(`http://127.0.0.1:${port}`, { autoConnect: false, timeout: 3000 });
  context.after(async () => {
    first.disconnect();
    second.disconnect();
    child.kill();
    await rm(dataDirectory, { recursive: true, force: true });
  });

  let healthy = false;
  let healthDetail = "no response";
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      healthy = response.ok;
      healthDetail = `HTTP ${response.status}`;
      if (healthy) break;
    } catch (error) {
      healthDetail = error.message;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  assert.equal(healthy, true, `server should start and serve health checks (${healthDetail}; ${childExit})${serverOutput ? `: ${serverOutput}` : ""}`);

  const firstConnected = new Promise((resolve, reject) => {
    first.once("connect", resolve);
    first.once("connect_error", reject);
  });
  const secondConnected = new Promise((resolve, reject) => {
    second.once("connect", resolve);
    second.once("connect_error", reject);
  });
  first.connect();
  second.connect();
  await Promise.all([firstConnected, secondConnected]);

  const initialBoard = waitForBoard(first);
  first.emit("board:join", { name: "Maya Chen" });
  const initial = await initialBoard;
  assert.equal(initial.tasks.length, 10);

  const twoMembers = waitForPresence(first, (members) => members.length === 2);
  const secondInitial = waitForBoard(second);
  second.emit("board:join", { name: "Leo Martins" });
  await Promise.all([twoMembers, secondInitial]);

  const created = waitForBoard(second, (board) => board.tasks.some((task) => task.title === "Review launch notes"));
  first.emit("task:create", {
    title: "Review launch notes",
    description: "Check final copy with the team.",
    status: "backlog",
    priority: "high",
    assigneeId: "maya",
    tags: ["Launch"],
  });
  const createdBoard = await created;
  const task = createdBoard.tasks.find((item) => item.title === "Review launch notes");

  const moved = waitForBoard(first, (board) => board.tasks.find((item) => item.id === task.id)?.status === "done");
  second.emit("task:move", { id: task.id, status: "done" });
  await moved;

  const persistedResponse = await fetch(`http://localhost:${port}/api/board`);
  const persistedBoard = await persistedResponse.json();
  assert.equal(persistedBoard.tasks.find((item) => item.id === task.id).status, "done");
  const savedData = JSON.parse(await readFile(dataPath, "utf8"));
  assert.equal(savedData.tasks.find((item) => item.id === task.id).status, "done");
});