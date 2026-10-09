import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export function createQuestionDeck(questionBank, historyPath, random = Math.random) {
  const questionIds = new Set(questionBank.map((question) => question.id));
  if (questionIds.size !== questionBank.length) throw new Error("Question IDs must be unique.");

  let usedIds = new Set();
  if (existsSync(historyPath)) {
    const saved = JSON.parse(readFileSync(historyPath, "utf8"));
    if (!Array.isArray(saved.usedIds)) throw new Error("Question history file is invalid.");
    usedIds = new Set(saved.usedIds.filter((id) => questionIds.has(id)));
  }

  function persist() {
    mkdirSync(path.dirname(historyPath), { recursive: true });
    const temporaryPath = `${historyPath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify({ usedIds: [...usedIds] }, null, 2), "utf8");
    renameSync(temporaryPath, historyPath);
  }

  return {
    draw(count) {
      if (!Number.isInteger(count) || count < 1 || count > questionBank.length) {
        throw new RangeError("Requested question count must fit within the bank.");
      }

      let available = questionBank.filter((question) => !usedIds.has(question.id));
      if (available.length < count) {
        usedIds = new Set();
        available = [...questionBank];
      }

      for (let index = available.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [available[index], available[swapIndex]] = [available[swapIndex], available[index]];
      }

      const selected = available.slice(0, count);
      for (const question of selected) usedIds.add(question.id);
      persist();
      return selected;
    },
  };
}