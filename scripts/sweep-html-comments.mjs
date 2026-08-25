#!/usr/bin/env node
// Sweep all tracked .html files for broken HTML comments:
// (a) unclosed <!-- ... (runs to EOF without -->)
// (b) bare "--" inside a comment that is not part of the closing "-->"
//     (this is exactly the mechanism that closes a comment early)
// (c) informational: comments that DO contain a literal "-->" substring
//     before their real close (these are the ones that actually leak text)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execSync("git ls-files -- *.html", { encoding: "utf8" })
  .split("\n")
  .map((s) => s.trim())
  .filter(Boolean);

let totalIssues = 0;

for (const file of files) {
  let s;
  try {
    s = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  let i = 0;
  let line = 1;
  let inComment = false;
  let commentStart = 0;
  const issues = [];

  while (i < s.length) {
    if (!inComment && s.startsWith("<!--", i)) {
      inComment = true;
      commentStart = line;
      i += 4;
      continue;
    }
    if (inComment && s.startsWith("-->", i)) {
      inComment = false;
      i += 3;
      continue;
    }
    if (inComment && s.startsWith("--", i)) {
      issues.push(
        `  line ${line}: bare "--" inside comment (opened line ${commentStart}) -- this closes the comment early at the next ">" if any follows nearby`
      );
      i += 2;
      continue;
    }
    if (!inComment && s.startsWith("-->", i)) {
      issues.push(`  line ${line}: orphan "-->" found outside any comment (visible text)`);
      i += 3;
      continue;
    }
    if (s[i] === "\n") line++;
    i++;
  }
  if (inComment) {
    issues.push(`  UNCLOSED comment: opened line ${commentStart}, never closed (runs to EOF)`);
  }

  if (issues.length) {
    totalIssues += issues.length;
    console.log(`\n${file}`);
    for (const iss of issues) console.log(iss);
  }
}

console.log(`\n--- TOTAL: ${totalIssues} issue(s) across ${files.length} tracked .html files ---`);
