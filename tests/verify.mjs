import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const requiredFiles = [
  "index.html",
  "css/style.css",
  "js/story.js",
  "js/audio.js",
  "js/game.js",
  "assets/images/cinema-rain-PLACEHOLDER.webp",
  ".github/workflows/deploy-pages.yml"
];

for (const file of requiredFiles) {
  assert.ok(fs.existsSync(path.join(root, file)), `Missing required file: ${file}`);
}

const html = read("index.html");
const css = read("css/style.css");
const game = read("js/game.js");

for (const relativePath of [
  "./css/style.css",
  "./js/story.js",
  "./js/audio.js",
  "./js/game.js",
  "./assets/images/cinema-rain-PLACEHOLDER.webp"
]) {
  assert.ok(html.includes(relativePath), `index.html does not reference ${relativePath}`);
  const localPath = relativePath.replace(/^\.\//, "");
  assert.ok(fs.existsSync(path.join(root, localPath)), `Referenced asset does not exist: ${localPath}`);
}

assert.ok(!/(?:src|href)=["']\/(?!\/)/.test(html), "Root-relative asset path found; this would break GitHub Pages subpaths");
assert.ok(css.includes("@media (max-width: 780px)"), "Mobile layout media query missing");
assert.ok(css.includes("prefers-reduced-motion"), "Reduced-motion support missing");
assert.ok(game.includes("localStorage"), "Save system missing");
assert.ok(game.includes("advanceDialogue"), "Dialogue advance system missing");
assert.ok(game.includes("choosePerspective"), "Perspective branch handler missing");
assert.ok(game.includes("replayOtherPerspective"), "Other-perspective replay missing");

const context = { window: {} };
vm.createContext(context);
vm.runInContext(read("js/story.js"), context);
const story = context.window.STORY;

assert.equal(story.prologue.length, 9, "Unexpected prologue entry count");
assert.equal(story.prologue[2].text, "“你今天来，是想让我留下，还是想证明我错了？”");
assert.equal(story.prologue[4].text, "“我只想知道，我到底有没有资格知道你的人生。”");
assert.equal(story.prologue[6].text, "“我没有骗过你。”");
assert.equal(story.prologue[8].text, "“可你也从来没有把真相给我。”");
assert.equal(story.perspectives.zhou.fragments.length, 4);
assert.equal(story.perspectives.lin.fragments.length, 4);
assert.equal(story.intertitles.before.main, "二百一十六天前");
assert.equal(story.intertitles.chapterOne.main, "我们开始的地方");

const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "Duplicate HTML id found");

console.log(`Verified ${requiredFiles.length} required files, ${ids.length} unique element IDs, both perspectives, and all core dialogue.`);
