// Checks that a Wizzly build still has everything spicy-wizzly.js hooks into.
// Usage: node compat.js <extracted assets dir>   (exit 1 when something is missing)
"use strict";
const fs = require("fs");
const path = require("path");

const dir = process.argv[2];
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(js|css|html)$/.test(f)) files.push(fs.readFileSync(p, "utf8"));
  }
})(dir);
const all = files.join("\n");

const NEEDS = {
  "Tauri command get_notch_state (what plays)": "get_notch_state",
  "Tauri command seek_media (click a line)": "seek_media",
  "media.positionSeconds": "positionSeconds",
  "media.durationSeconds": "durationSeconds",
  "?view=notch / ?view=karaoke windows": "`view`",
  "island: .notch-pill": "notch-pill",
  "island: .notch-compact-row": "notch-compact-row",
  "island: .notch-compact-clock": "notch-compact-clock",
  "island: .notch-compact-lyric-wrap": "notch-compact-lyric-wrap",
  "island: .notch-lyrics-viewport": "notch-lyrics-viewport",
  "island: .notch-lyrics-head-btns": "notch-lyrics-head-btns",
  "island cover: .notch-art-box": "notch-art-box",
  "island cover: .notch-mini-cover-wrap": "notch-mini-cover-wrap",
  "karaoke: .karaoke-viewport": "karaoke-viewport",
  "karaoke: .karaoke-controls": "karaoke-controls",
  "karaoke: .karaoke-card": "karaoke-card",
  "control center: .cc-media-art": "cc-media-art",
};

let missing = 0;
const lines = [];
for (const [label, needle] of Object.entries(NEEDS)) {
  const ok = all.includes(needle);
  if (!ok) missing++;
  lines.push(`| ${ok ? "✅" : "❌"} | ${label} |`);
}
console.log("| | What the mod uses |\n|---|---|\n" + lines.join("\n"));
process.exit(missing ? 1 : 0);
