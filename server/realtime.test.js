import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once as onceEvent } from "node:events";
import { createServer as createTcpServer } from "node:net";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";

function waitForSocketEvent(socket, eventName, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, onEvent);
      socket.off("connect_error", onError);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);
    const onEvent = (value) => {
      clearTimeout(timer);
      socket.off("connect_error", onError);
      resolve(value);
    };
    const onError = (error) => {
      clearTimeout(timer);
      socket.off(eventName, onEvent);
      reject(error);
    };
    socket.once(eventName, onEvent);
    socket.once("connect_error", onError);
  });
}

function waitForPresenceCount(socket, count) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("room:presence", onPresence);
      reject(new Error(`Timed out waiting for ${count} online members`));
    }, 5000);
    const onPresence = (members) => {
      if (members.length !== count) return;
      clearTimeout(timer);
      socket.off("room:presence", onPresence);
      resolve(members);
    };
    socket.on("room:presence", onPresence);
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

test("room presence, chat, and timer are shared across clients", async (context) => {
  const port = await reservePort();
  const serverPath = fileURLToPath(new URL("./index.js", import.meta.url));
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  const clients = [
    io(`http://127.0.0.1:${port}`, { autoConnect: false, timeout: 3000 }),
    io(`http://127.0.0.1:${port}`, { autoConnect: false, timeout: 3000 }),
  ];

  context.after(() => {
    clients.forEach((client) => client.disconnect());
    child.kill();
  });

  let healthy = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      healthy = response.ok;
      if (healthy) break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  assert.equal(healthy, true, "server should start and expose its health endpoint");

  const [first, second] = clients;
  const firstConnected = waitForSocketEvent(first, "connect");
  const secondConnected = waitForSocketEvent(second, "connect");
  first.connect();
  second.connect();
  await Promise.all([firstConnected, secondConnected]);

  const firstState = waitForSocketEvent(first, "room:state");
  first.emit("room:join", { name: "Ari", roomId: "test-room" });
  await firstState;

  const secondState = waitForSocketEvent(second, "room:state");
  const presenceUpdate = waitForPresenceCount(first, 2);
  second.emit("room:join", { name: "Bea", roomId: "test-room" });
  await secondState;
  assert.equal((await presenceUpdate).length, 2);

  const receivedMessage = waitForSocketEvent(second, "room:message");
  first.emit("room:message", "We have got this");
  assert.equal((await receivedMessage).text, "We have got this");

  const timerUpdate = waitForSocketEvent(second, "room:timer");
  first.emit("timer:command", { action: "start" });
  assert.equal((await timerUpdate).status, "running");
});