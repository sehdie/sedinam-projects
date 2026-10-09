import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { QUESTIONS, QUESTIONS_PER_GAME } from "./questions.js";
import { createQuestionDeck } from "./question-deck.js";

test("question sessions are shuffled and do not repeat until the bank is exhausted", async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), "quiz-question-deck-"));
  const historyPath = path.join(directory, "history.json");
  context.after(() => rm(directory, { recursive: true, force: true }));

  assert.equal(QUESTIONS.length % QUESTIONS_PER_GAME, 0);
  let deck = createQuestionDeck(QUESTIONS, historyPath, () => 0.37);
  const sessions = [];

  for (let index = 0; index < QUESTIONS.length / QUESTIONS_PER_GAME; index += 1) {
    if (index === 2) {
      deck = createQuestionDeck(QUESTIONS, historyPath, () => 0.73);
    }
    sessions.push(deck.draw(QUESTIONS_PER_GAME).map((question) => question.id));
  }

  const seenIds = new Set();
  for (const session of sessions) {
    assert.equal(session.length, QUESTIONS_PER_GAME);
    assert.equal(new Set(session).size, QUESTIONS_PER_GAME, "a session should not contain duplicate questions");
    for (const questionId of session) {
      assert.equal(seenIds.has(questionId), false, "a question should not repeat before the bank is exhausted");
      seenIds.add(questionId);
    }
  }
  assert.equal(seenIds.size, QUESTIONS.length);

  const recycledSession = createQuestionDeck(QUESTIONS, historyPath, () => 0.41).draw(QUESTIONS_PER_GAME);
  assert.equal(recycledSession.length, QUESTIONS_PER_GAME, "a fresh cycle should begin after every question was used");
});