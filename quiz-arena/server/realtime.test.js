import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once as onceEvent } from "node:events";
import { createServer as createTcpServer } from "node:net";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { io } from "socket.io-client";
import { QUESTIONS } from "./questions.js";

function waitForState(socket, predicate = () => true, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const onState = (state) => {
      if (!predicate(state)) return;
      clearTimeout(timer);
      socket.off("room:state", onState);
      resolve(state);
    };
    const timer = setTimeout(() => {
      socket.off("room:state", onState);
      reject(new Error("Timed out waiting for room state"));
    }, timeoutMs);
    socket.on("room:state", onState);
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

test("hosted quiz synchronizes players, validates answers, and reveals scores", async (context) => {
  const port = await reservePort();
  const serverPath = fileURLToPath(new URL("./index.js", import.meta.url));
  let serverOutput = "";
  let childExit = "still running";
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(port),
      QUIZ_QUESTION_SECONDS: "3",
      QUIZ_REVEAL_SECONDS: "1",
      QUIZ_BOT_THINK_MIN_MS: "50",
      QUIZ_BOT_THINK_VARIANCE_MS: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { serverOutput += chunk; });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { serverOutput += chunk; });
  child.on("exit", (code, signal) => { childExit = `exit ${code}, signal ${signal}`; });
  const host = io(`http://localhost:${port}`, { autoConnect: false, timeout: 3000 });
  const guest = io(`http://localhost:${port}`, { autoConnect: false, timeout: 3000 });
  context.after(() => {
    host.disconnect();
    guest.disconnect();
    child.kill();
  });

  let healthy = false;
  let healthDetail = "no response";
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`);
      healthy = response.ok;
      healthDetail = `HTTP ${response.status}`;
      if (healthy) break;
    } catch (error) {
      healthDetail = error.message;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  assert.equal(healthy, true, `server should start and serve health checks (${healthDetail}; ${childExit})${serverOutput ? `: ${serverOutput}` : ""}`);

  const hostConnected = new Promise((resolve, reject) => {
    host.once("connect", resolve);
    host.once("connect_error", reject);
  });
  const guestConnected = new Promise((resolve, reject) => {
    guest.once("connect", resolve);
    guest.once("connect_error", reject);
  });
  host.connect();
  guest.connect();
  await Promise.all([hostConnected, guestConnected]);

  const lobby = waitForState(host, (state) => state.phase === "lobby");
  host.emit("room:create", { name: "Host" });
  const createdRoom = await lobby;
  assert.match(createdRoom.roomCode, /^[A-Z0-9]{4}$/);

  const guestLobby = waitForState(guest, (state) => state.phase === "lobby" && state.players.length === 2);
  guest.emit("room:join", { name: "Guest", roomCode: createdRoom.roomCode });
  await guestLobby;

  const hostQuestion = waitForState(host, (state) => state.phase === "question");
  const guestQuestion = waitForState(guest, (state) => state.phase === "question");
  host.emit("game:start");
  const [hostStarted, guestStarted] = await Promise.all([hostQuestion, guestQuestion]);
  assert.equal(hostStarted.question.prompt, guestStarted.question.prompt);
  assert.equal("correctIndex" in hostStarted.question, false, "correct answer must stay hidden during the round");

  const revealForHost = waitForState(host, (state) => state.phase === "reveal");
  const revealForGuest = waitForState(guest, (state) => state.phase === "reveal");
  const correctAnswer = QUESTIONS.find((question) => question.prompt === hostStarted.question.prompt).correctIndex;
  host.emit("game:answer", correctAnswer);
  guest.emit("game:answer", (correctAnswer + 1) % 4);
  const [hostReveal, guestReveal] = await Promise.all([revealForHost, revealForGuest]);
  assert.equal(hostReveal.question.correctIndex, correctAnswer);
  assert.equal(hostReveal.players.find((player) => player.name === "Host").score > 0, true);
  assert.equal(hostReveal.players.find((player) => player.name === "Guest").score, 0);
  assert.equal(guestReveal.question.explanation, hostReveal.question.explanation);

  const soloLobby = waitForState(host, (state) => state.phase === "lobby");
  host.emit("room:create", { name: "Solo" });
  await soloLobby;
  const soloQuestion = waitForState(host, (state) => state.phase === "question");
  host.emit("game:solo");
  const soloStarted = await soloQuestion;
  assert.equal(soloStarted.players.length, 2);
  assert.equal(soloStarted.players.find((player) => player.isBot).name, "QuizBot");

  const soloReveal = waitForState(host, (state) => state.phase === "reveal", 6000);
  const soloAnswer = QUESTIONS.find((question) => question.prompt === soloStarted.question.prompt).correctIndex;
  host.emit("game:answer", soloAnswer);
  const soloResult = await soloReveal;
  assert.equal(soloResult.players.find((player) => player.name === "Solo").score > 0, true);
  assert.equal(soloResult.players.find((player) => player.isBot).answered, true);

  const seenQuestionIds = new Set([soloStarted.question.id]);
  for (let questionNumber = 2; questionNumber <= QUESTIONS.length; questionNumber += 1) {
    const nextQuestion = waitForState(host, (state) => state.phase === "question" && state.questionNumber === questionNumber);
    const nextReveal = waitForState(host, (state) => state.phase === "reveal" && state.questionNumber === questionNumber);
    const questionState = await nextQuestion;
    assert.equal(seenQuestionIds.has(questionState.question.id), false, "a game should not repeat questions");
    seenQuestionIds.add(questionState.question.id);
    const answer = QUESTIONS.find((question) => question.id === questionState.question.id).correctIndex;
    host.emit("game:answer", answer);
    const reveal = await nextReveal;
    assert.equal(reveal.players.find((player) => player.isBot).answered, true);
  }

  const results = await waitForState(host, (state) => state.phase === "results", 5000);
  assert.equal(results.questionNumber, QUESTIONS.length);
  assert.equal(results.questionTotal, QUESTIONS.length);
  assert.equal(seenQuestionIds.size, QUESTIONS.length);
});