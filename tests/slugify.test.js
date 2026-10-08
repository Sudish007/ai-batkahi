import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, slugFromFilename } from "../src/lib/slugify.js";

test("slugify lower-cases and hyphenates", () => {
  assert.equal(slugify("AI Se Sahi  Sawal!"), "ai-se-sahi-sawal");
  assert.equal(slugify("--Hello World--"), "hello-world");
  assert.equal(slugify("Kaggle Learn 101"), "kaggle-learn-101");
});

test("slugify drops non-Latin characters", () => {
  assert.equal(slugify("समझ"), "");
  assert.equal(slugify("ML (मशीन लर्निंग)"), "ml");
});

test("slugFromFilename strips numeric prefix and extension", () => {
  assert.equal(slugFromFilename("03-ai-se-sahi-sawal.md"), "ai-se-sahi-sawal");
  assert.equal(slugFromFilename("01-machine-learning-ka-hola.md"), "machine-learning-ka-hola");
  assert.equal(slugFromFilename("no-prefix.md"), "no-prefix");
});
