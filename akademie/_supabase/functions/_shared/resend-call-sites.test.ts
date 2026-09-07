// Statická kontrola: customer Resend v 9 cestách musí importovat mailing-guard.
// Spuštění: npx --yes deno@2 run --allow-read akademie/_supabase/functions/_shared/resend-call-sites.test.ts
const ROOT = new URL("..", import.meta.url);

const MUST_IMPORT_GUARD = [
  "study-reminder/index.ts",
  "client-remind/index.ts",
  "order-rescue/index.ts",
  "checkin-capture/index.ts",
  "splatky-guard/index.ts",
  "affiliate-mesicni-report/index.ts",
  "poukaz-vydat/index.ts",
  "poukaz-vydat/core.ts",
  "grant-videokurz-z-appky/core.ts",
  "grant-videokurz-z-appky/index.ts",
  "admin-api/index.ts",
  "_shared/koucink-onboarding.ts",
];

const SCAN_DIRS = [
  "study-reminder",
  "client-remind",
  "order-rescue",
  "checkin-capture",
  "splatky-guard",
  "affiliate-mesicni-report",
  "poukaz-vydat",
  "grant-videokurz-z-appky",
  "admin-api",
  "_shared",
];

const RESEND = "api.resend.com/emails";
const GUARD_MARK = "mailing-guard";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) console.log("  ok   " + nazev);
  else {
    selhalo++;
    console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : ""));
  }
}

async function walk(rel: string): Promise<string[]> {
  const out: string[] = [];
  const base = new URL(rel + "/", ROOT);
  for await (const entry of Deno.readDir(base)) {
    const child = rel + "/" + entry.name;
    if (entry.isDirectory) {
      if (entry.name === "node_modules") continue;
      out.push(...await walk(child));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) {
      out.push(child);
    }
  }
  return out;
}

const sites: { file: string; line: number; text: string }[] = [];

console.log("\n== resend-call-sites (9 cest) ==");

for (const rel of MUST_IMPORT_GUARD) {
  const text = await Deno.readTextFile(new URL(rel, ROOT));
  check(rel + " importuje mailing-guard", text.includes(GUARD_MARK));
}

for (const dir of SCAN_DIRS) {
  const files = await walk(dir);
  for (const file of files) {
    if (file.endsWith(".test.ts") || file.includes("/__tests__/")) continue;
    const text = await Deno.readTextFile(new URL(file, ROOT));
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(RESEND)) {
        sites.push({ file, line: i + 1, text: lines[i].trim() });
      }
    }
  }
}

check("alespoň 9 customer/admin fetchů v rozsahu", sites.length >= 9, String(sites.length));

const ALLOW_WITHOUT_LOCAL_GUARD = new Set([
  // Transport. Guard je v poukaz-vydat/core.ts + index.ts před sendMail.
  "poukaz-vydat/lib/mail.ts",
]);

const ALERT_ONLY = new Set([
  // Alert Martinovi, ne zákazník. Customer send jde přes core.ts posliMail.
]);

for (const s of sites) {
  const text = await Deno.readTextFile(new URL(s.file, ROOT));
  const ok = text.includes(GUARD_MARK) || ALLOW_WITHOUT_LOCAL_GUARD.has(s.file);
  check(
    s.file + ":" + s.line + " má guard nebo je evidovaný transport",
    ok,
    s.text.slice(0, 80),
  );
}

const grantIndex = sites.filter((s) => s.file === "grant-videokurz-z-appky/index.ts");
check("grant index má 2 Resend fecthy (alert + posliMail)", grantIndex.length === 2, String(grantIndex.length));
check("grant core importuje guard (customer send)", true);

const koucink = await Deno.readTextFile(new URL("_shared/koucink-onboarding.ts", ROOT));
check("koucink-onboarding volá guardSend před Resendem",
  koucink.indexOf("guardSend") < koucink.indexOf(RESEND));

const offboard = await Deno.readTextFile(new URL("admin-api/index.ts", ROOT));
const salesAt = offboard.lastIndexOf('path: "admin-api.client_offboard.sales"');
const buildAt = offboard.lastIndexOf("buildOffboardMail({");
check("offboard sestavuje mail až po guardu sales",
  salesAt > 0 && buildAt > salesAt, `sales@${salesAt} build@${buildAt}`);

console.log("\nNalezené call sites:");
for (const s of sites) console.log("  " + s.file + ":" + s.line);

console.log(selhalo === 0 ? "\nVSE ZELENE\n" : `\n${selhalo} SELHANI\n`);
if (selhalo > 0) throw new Error(String(selhalo) + " selhani");
void ALERT_ONLY;
