// Vygeneruje weekly.ts z texty-tydenni/NN-*.md. Placeholdery {{...}} nechává v textu.
// Spuštění (ze složky functions/en-mailing): node scripts/gen-weekly.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "texty-tydenni");
const nameRe = /^(\d\d)-[^.]+\.md$/;

const names = readdirSync(dir).filter((n) => nameRe.test(n));
names.sort((a, b) => Number(a.slice(0, 2)) - Number(b.slice(0, 2)));
if (names.length !== 36) {
  throw new Error(`texty-tydenni: očekávám přesně 36 souborů NN-*.md, je jich ${names.length}`);
}
for (let i = 0; i < 36; i++) {
  const nn = Number(names[i].slice(0, 2));
  if (nn !== i + 1) {
    throw new Error(`texty-tydenni: NN nejdou souvisle 01..36, na pozici ${i + 1} je ${names[i]}`);
  }
}

function linesOf(raw) {
  return raw.split("\n").map((l) => (l.endsWith("\r") ? l.slice(0, -1) : l));
}

function field(line, label, file) {
  const prefix = label + ": ";
  if (!line.startsWith(prefix)) throw new Error(`${file}: chybí řádek "${prefix.trim()}"`);
  return line.slice(prefix.length);
}

function parse(file, raw) {
  const lines = linesOf(raw);
  const subjectAt = lines.findIndex((l) => l.startsWith("Subject:"));
  const preAt = lines.findIndex((l) => l.startsWith("Preheader:"));
  const bodyAt = lines.findIndex((l) => l === "Body:");
  const footerAt = lines.findIndex((l) => l.startsWith("You get this email because"));
  const sourceAt = lines.findIndex((l) => l.startsWith("Source:"));
  if (subjectAt < 0 || preAt < 0 || bodyAt < 0 || footerAt < 0 || sourceAt < 0) {
    throw new Error(`${file}: chybný formát (Subject, Preheader, Body, patička, Source)`);
  }
  if (!(subjectAt < preAt && preAt < bodyAt && bodyAt < footerAt && footerAt < sourceAt)) {
    throw new Error(`${file}: řádky nejsou v pořadí Subject, Preheader, Body, patička, Source`);
  }
  const subject = field(lines[subjectAt], "Subject", file);
  const preheader = field(lines[preAt], "Preheader", file);
  const body = lines.slice(bodyAt + 1, footerAt).join("\n").trim();
  if (!subject || !preheader || !body) throw new Error(`${file}: prázdný subject, preheader nebo tělo`);
  return { subject, preheader, body };
}

const items = names.map((name) => parse(name, readFileSync(join(dir, name), "utf8")));
const entries = items.map((it) =>
  `  { subject: ${JSON.stringify(it.subject)}, preheader: ${JSON.stringify(it.preheader)}, body: ${JSON.stringify(it.body)} }`
);
const out = `// vygenerováno scripts/gen-weekly.mjs, needitovat ručně
export const WEEKLY: { subject: string; preheader: string; body: string }[] = [
${entries.join(",\n")}
];
`;
writeFileSync(join(root, "weekly.ts"), out, "utf8");
console.log(`weekly.ts: ${items.length}`);
