// en-mailing: čisté funkce (výběr kroku, plán běhu, texty mailů, odhlašovací token).
// Bez sítě a bez DB, aby šly testovat (logic_test.ts). Síť a DB jsou v index.ts.
//
// Texty: _Claude-dokumenty/2026-10-13_en-klienti/texty/emails-en-1-5.md (Fable, 13. 10. 2026).
// ⛔ Kdo mění text tady, mění i tam (nebo napíše proč ne). Varianta mailu 1 BEZ čísel
//    (lead bez výsledku kalkulačky, typicky /en/workout/) v .md doslova není, je dopsaná tady
//    podle pokynu v .md ("blok s čísly vynechat a nechat jen odkaz na kalkulačku").
// ⛔ Ceny nikdy v kódu: {{price_block}} je prázdný, takže se v mailu 5 ani v týdenních nezobrazí.
// Kroky 6..41: weekly.ts (generátor scripts/gen-weekly.mjs ze texty-tydenni/). Needitovat ručně.

import { WEEKLY } from "./weekly.ts";

// ---------------------------------------------------------------------------
// Pravidla série
// ---------------------------------------------------------------------------
export const SERIES_KINDS = ["kit", "calculator", "workout"];
/** Den od startu série (nejstarší lead daného e-mailu), od kterého smí odejít krok.
 *  1..5: 0, 2, 4, 6, 8. 6..41: 8 + 7*(krok-5), krok 6 den 15, krok 41 den 260. */
const INTRO_DAYS = [0, 2, 4, 6, 8];
export const STEPS = 41;
export const SCHEDULE_DAYS: number[] = Array.from({ length: STEPS }, (_, i) => {
  const step = i + 1;
  return step <= INTRO_DAYS.length ? INTRO_DAYS[i] : 8 + 7 * (step - 5);
});
export const MAX_PER_RUN = 50;
/** Krok 1 nezačne, když je start starší (lead z doby před zapnutím by dostal "hned po přihlášení" po měsíci). */
export const MAX_START_AGE_DAYS = 14;
/** Mezi dvěma maily téhož člověka aspoň tolik hodin. Kroky 1..5 (dohánění po pauze nepošle dva maily za den). */
export const MIN_GAP_HOURS = 20;
/** Kroky 6..41: aspoň 144 h od posledního mailu. */
export const MIN_GAP_HOURS_WEEKLY = 144;

if (WEEKLY.length !== STEPS - INTRO_DAYS.length) {
  throw new Error("WEEKLY: expected " + (STEPS - INTRO_DAYS.length) + ", got " + WEEKLY.length);
}
/** Kdo poslal přihlášku do koučinku, je v osobní konverzaci s Martinem; prodejní série mu nechodí. */
export const SKIP_IF_APPLIED = true;
export const TEST_EMAIL = "fitness.barna@gmail.com";
export const TEST_NAME = "TEST-CLAUDE";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export type Lead = {
  id: string;
  created_at: string;
  kind: string;
  first_name: string | null;
  email: string;
  consent: boolean | null;
  calc: unknown;
};
export type LogRow = { lead_email: string; step: number; sent_at: string; status?: string };
export type Calc = { kcal: number; protein_g: number };

export type SkipReason =
  | "no_series_lead"
  | "no_consent"
  | "unsubscribed"
  | "applied"
  | "test_live"
  | "done"
  | "too_old"
  | "not_yet"
  | "gap"
  | "bad_date";

export type StepDecision = { step: number } | { step: null; reason: SkipReason };

export function isTestLead(l: Pick<Lead, "first_name" | "email">): boolean {
  return (l.first_name ?? "").trim().toUpperCase() === TEST_NAME ||
    (l.email ?? "").trim().toLowerCase() === TEST_EMAIL;
}

/**
 * Který krok je na řadě. Další krok = nejvyšší zalogovaný + 1 (bez ohledu na status: i 'failed'
 * a 'sending' se počítají jako spotřebované, ⛔ nic se neopakuje a nikdy se nejde zpátky).
 */
export function nextStep(startIso: string, rows: LogRow[], now: Date): StepDecision {
  const start = Date.parse(startIso);
  if (!Number.isFinite(start)) return { step: null, reason: "bad_date" };
  const maxStep = rows.reduce((m, r) => Math.max(m, Number(r.step) || 0), 0);
  if (maxStep >= STEPS) return { step: null, reason: "done" };
  const step = maxStep + 1;
  const ageMs = now.getTime() - start;
  if (step === 1 && ageMs > MAX_START_AGE_DAYS * DAY_MS) return { step: null, reason: "too_old" };
  if (ageMs < SCHEDULE_DAYS[step - 1] * DAY_MS) return { step: null, reason: "not_yet" };
  if (rows.length) {
    const last = rows.reduce((m, r) => Math.max(m, Date.parse(r.sent_at) || 0), 0);
    const gapH = step >= 6 ? MIN_GAP_HOURS_WEEKLY : MIN_GAP_HOURS;
    if (now.getTime() - last < gapH * HOUR_MS) return { step: null, reason: "gap" };
  }
  return { step };
}

/** Výsledek kalkulačky použitelný v mailu 1, jinak null (mail 1 pak jde ve variantě bez čísel). */
export function cleanCalc(v: unknown): Calc | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const kcal = Number(o.kcal);
  const protein = Number(o.protein_g);
  if (o.kcal === null || o.protein_g === null) return null;
  if (!Number.isFinite(kcal) || kcal < 800 || kcal > 8000) return null;
  if (!Number.isFinite(protein) || protein < 20 || protein > 500) return null;
  return { kcal: Math.round(kcal), protein_g: Math.round(protein) };
}

export type PlanItem = {
  email: string;
  lead_id: string;
  step: number;
  kind: string;
  first_name: string;
  calc: Calc | null;
  test: boolean;
  start_at: string;
};

export type Plan = {
  mode: "live" | "dry";
  items: PlanItem[];
  capped: number;
  skipped: Partial<Record<SkipReason, number>>;
};

const byTime = (a: Lead, b: Lead) =>
  (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0) || a.id.localeCompare(b.id);

/**
 * Plán jednoho běhu. ⛔ enabled=false NEBO dry_run = mode 'dry' (index.ts pak nic nerazítkuje
 * ani neposílá). Testovací řádky (TEST-CLAUDE, fitness.barna@gmail.com) jen v dry.
 */
export function planRun(input: {
  leads: Lead[];
  log: LogRow[];
  unsubscribed: Iterable<string>;
  now: Date;
  enabled: boolean;
  dryRun: boolean;
  max?: number;
}): Plan {
  const mode: Plan["mode"] = input.enabled === true && input.dryRun !== true ? "live" : "dry";
  const max = input.max ?? MAX_PER_RUN;
  const unsub = new Set(Array.from(input.unsubscribed, (e) => e.trim().toLowerCase()));
  const logBy = new Map<string, LogRow[]>();
  for (const r of input.log) {
    const k = r.lead_email.trim().toLowerCase();
    if (!logBy.has(k)) logBy.set(k, []);
    logBy.get(k)!.push(r);
  }
  const groups = new Map<string, Lead[]>();
  for (const l of input.leads) {
    const k = (l.email ?? "").trim().toLowerCase();
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(l);
  }

  const skipped: Plan["skipped"] = {};
  const skip = (r: SkipReason) => (skipped[r] = (skipped[r] ?? 0) + 1);
  const items: PlanItem[] = [];

  for (const [email, all] of groups) {
    const series = all.filter((l) => SERIES_KINDS.includes(l.kind)).sort(byTime);
    if (!series.length) { skip("no_series_lead"); continue; }
    const start = series[0];
    if (start.consent !== true) { skip("no_consent"); continue; }
    if (unsub.has(email)) { skip("unsubscribed"); continue; }
    if (SKIP_IF_APPLIED && all.some((l) => l.kind === "application")) { skip("applied"); continue; }
    const test = all.some(isTestLead);
    if (test && mode === "live") { skip("test_live"); continue; }
    const d = nextStep(start.created_at, logBy.get(email) ?? [], input.now);
    if (d.step === null) { skip(d.reason); continue; }
    // Čísla z nejnovějšího leadu, který je má (např. nejdřív workout bez čísel, pak kalkulačka).
    let calc: Calc | null = null;
    for (let i = series.length - 1; i >= 0 && !calc; i--) calc = cleanCalc(series[i].calc);
    items.push({
      email,
      lead_id: start.id,
      step: d.step,
      kind: start.kind,
      first_name: start.first_name ?? "",
      calc,
      test,
      start_at: start.created_at,
    });
  }

  items.sort((a, b) => (Date.parse(a.start_at) || 0) - (Date.parse(b.start_at) || 0));
  const capped = Math.max(0, items.length - max);
  return { mode, items: items.slice(0, max), capped, skipped };
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return user.slice(0, 2) + "***@" + domain;
}

// ---------------------------------------------------------------------------
// Texty mailů
// ---------------------------------------------------------------------------
export const SITE = "https://martinbarna.cz";
export const LINKS = {
  playbook: `${SITE}/go/en-playbook-m/`,
  calculator: `${SITE}/go/en-calc-m/`,
  weight: `${SITE}/go/en-vaha-m/`,
  steps: `${SITE}/go/en-kroky-m/`,
  weekend: `${SITE}/go/en-vikend-m/`,
  apply: `${SITE}/go/en-apply-m/`,
};
export const POSTAL_ADDRESS = "Martin Barna, IČO 76383032, Lumírova 489/11, 700 30 Ostrava-Výškovice, Czech Republic";

const FOOTER = `You get this email because you asked for the Fat Loss Kit at martinbarna.cz/en/.
Unsubscribe: {{unsubscribe_url}}
{{postal_address}}`;

type Template = { subject: string; preheader: string; body: string };

const MAIL1_NUMBERS: Template = {
  subject: "Your numbers + the Eating Out Playbook",
  preheader: "{{kcal}} kcal and {{protein_g}} g of protein a day. And one question for you.",
  body: `Hi {{first_name}},

Here are your numbers from the calculator:

{{kcal}} kcal a day
{{protein_g}} g of protein a day

What to do with them this week:
1) Eat around {{kcal}} kcal most days. Some days you'll be over, some under. The week average is what counts.
2) Hit the protein every day. Spread it over 3 to 4 meals. A palm of meat or fish is about 20 to 30 g of protein. If your target is higher, make the portions bigger or add a fifth meal.
3) Weigh yourself and measure your waist once a week, morning, same conditions. Write both down.

After 2 to 3 weeks the trend tells you if the number is right. If it isn't, you move it by 100 to 200 kcal. That's the whole system. The rest is details.

Your Eating Out Playbook (PDF): {{playbook_url}}
8 types of places: what to order and which extras add 500 kcal to a meal. Start with the steakhouse and the bar. That's where I see my clients go over the most.

In case we haven't met: I'm Martin Barna, nutrition and fitness coach from Czechia. Coaching since 2013, 600+ clients, guest on Czech national TV. I coach busy people in writing: weekly check-ins, normal food, restaurants included.

Now one question for you. Hit reply and write me one line: what breaks your diet the most right now? Business dinners, travel, weekends, evenings at home, no time? I read every reply myself and I answer every one.

Be Effective!
Martin`,
};

// Varianta bez čísel (dopsaná v kódu, v .md doslova není; prošlá hlasem 19. 10. 2026, čeká na Martinovo schválení).
const MAIL1_NO_NUMBERS: Template = {
  subject: "Your Eating Out Playbook + the two numbers that matter",
  preheader: "Calories and protein a day, what to do with them this week. And one question for you.",
  body: `Hi {{first_name}},

Everything starts with two numbers: calories a day and protein a day. The calculator gives you both in 30 seconds: ${LINKS.calculator}

What to do with them this week:
1) Eat around your calorie number most days. Some days you'll be over, some under. The week average is what counts.
2) Hit the protein every day. Spread it over 3 to 4 meals. A palm of meat or fish is about 20 to 30 g of protein. If your target is higher, make the portions bigger or add a fifth meal.
3) Weigh yourself and measure your waist once a week, morning, same conditions. Write both down.

After 2 to 3 weeks the trend tells you if the number is right. If it isn't, you move it by 100 to 200 kcal. That's the whole system. The rest is details.

Your Eating Out Playbook (PDF): {{playbook_url}}
8 types of places: what to order and which extras add 500 kcal to a meal. Start with the steakhouse and the bar. That's where I see my clients go over the most.

In case we haven't met: I'm Martin Barna, nutrition and fitness coach from Czechia. Coaching since 2013, 600+ clients, guest on Czech national TV. I coach busy people in writing: weekly check-ins, normal food, restaurants included.

Now one question for you. Hit reply and write me one line: what breaks your diet the most right now? Business dinners, travel, weekends, evenings at home, no time? I read every reply myself and I answer every one.

Be Effective!
Martin`,
};

const MAIL2: Template = {
  subject: "Up 1.4 kg this morning. It wasn't fat.",
  preheader: "1 to 2 kg in a day is water and glycogen. What to measure instead.",
  body: `Hi {{first_name}},

Monday morning, scale up 1.4 kg. Sunday you had a pizza and two beers. Tuesday morning, down 1.1 kg. You lost no fat on Monday and you gained no fat on Sunday. 1 kg of fat is about 7,700 kcal; a pizza and two beers are 1,500.

What moved the scale:
- Glycogen. Your muscles and liver store carbs as glycogen, and every gram of it holds about 3 grams of water. An untrained body has roughly 500 g of glycogen. Fill the stores after a carb-heavy day and the scale moves by a kilo or two without a gram of fat.
- Salt. A restaurant dinner is salty; salt holds water for a day or two.
- Food in your gut. A big dinner weighs something until it's gone.
- Sleep, stress, a long flight, for women the cycle. All of it shows up on the scale.

I see this in reports every week: scale flat or up, waist down 2 cm. Looking only at the scale, the client would call it a bad week. It was a good one.

What to watch instead:
1) Weigh in the morning, after the bathroom, before food, same scale. Daily if you can handle it, then compare weekly averages instead of two single days.
2) Waist once a week, same spot (at the navel), same time. This number is the one I trust most for belly fat.
3) A photo once a month, same light, same place.

If the weekly average and the waist go down over 3 weeks, you're losing fat. Whatever one morning says.

The longer version with the numbers: ${LINKS.weight}

Be Effective!
Martin`,
};

const MAIL3: Template = {
  subject: "The minimum version (for the week that falls apart)",
  preheader: "Three things that keep the result moving when everything else is on fire.",
  body: `Hi {{first_name}},

The weeks that break results, in what I see with clients, are the all-or-nothing ones. Trip on Tuesday, dinner on Wednesday, "I'll start again Monday" by Thursday. Four days of nothing erase ten days of work.

So with every client I agree on the minimum version in advance, before the bad week comes. Three things, nothing else:

1) Protein in every meal. A palm of meat, fish, eggs, yogurt, cottage cheese. Airport, hotel, gas station, there's always one option.
2) 8,000 steps. Airports and cities give you half of it for free.
3) Write down roughly what you ate. Even a guess. A rough number beats no number.

That's it. Done every day of a bad week, it stops the week from turning into a total write-off. It doesn't replace the calorie target. Then the normal plan again.

Two rules that go with it:
- Count 1, not 0. One missed day means nothing. Two in a row, fix it the same day. That's where the new (bad) habit starts.
- Shrink the dose and keep the goal. In a crazy week the goal is a protein breakfast and a 20 minute walk, done. A small habit you kept beats a big one you dropped.

In the playbook, the chapter "The minimum version for travel days" is the same thing with a shopping list for the airport.

Why 8,000 steps and what they're worth in kcal: ${LINKS.steps}

Be Effective!
Martin`,
};

const MAIL4: Template = {
  subject: "Weekend math: 5 days of work, 2 days that erase it",
  preheader: "-2,500 plus +2,500 = zero. How to keep the weekend and the result.",
  body: `Hi {{first_name}},

5 days at -500 kcal = -2,500 kcal
Saturday: brunch, drinks, takeout = +1,250 kcal over your number
Sunday: the same = +1,250
Result for the week = zero.

And you'll swear you eat clean. You do, Monday to Friday.

This is the most common week I see in new clients. The fix is cheaper than it looks, because you keep the weekend:

1) Pick one meal out, not all of them. Saturday dinner with friends is the event. Breakfast and lunch that day are normal meals.
2) Bank for it. Monday to Thursday a bit lower, 300 to 500 kcal under your number, and you have 1,200 to 2,000 kcal saved for a proper Saturday dinner. The weekly average can stay in a deficit.
3) At the restaurant: protein and vegetables first, one portion of carbs, sauces on the side. Steak with vegetables, one glass, no dessert = around 900 kcal. Starter, steak with fries, dessert, three glasses = easily 1,800. Same table, same people.
4) Alcohol in numbers. A small glass of wine (150 ml) is about 120 to 130 kcal, a large restaurant pour about 150 to 220. A pint of beer is 200 to 250, a cocktail 200 to 500 (a creamy one is the top of that). Decide the number of drinks before the night, water between them.
5) Monday is a normal day, without fasting, detox or two hours of cardio as punishment. You can go 100 to 200 kcal lower for two or three days if you want. Guilt only starts the next round.

One free meal is one meal. A dessert at lunch doesn't make dinner a free-for-all. That one sentence has saved more weekends for my clients than any diet rule.

How to keep the weekend and still lose fat, the full version: ${LINKS.weekend}

Be Effective!
Martin`,
};

const MAIL5: Template = {
  subject: "Want me to set this up for you?",
  preheader: "Written coaching, weekly check-ins, no calls. Who it's for and who it isn't.",
  body: `Hi {{first_name}},

This is the last email of the kit series. You have the numbers, the playbook, the minimum version and the weekend math. Some people take that and run with it, and that's fine with me.

If you'd rather have someone set it up for you and check it every week, this is how I work with English-speaking clients:

1) You apply in writing (link below). I usually reply within 24 hours on working days with a few questions.
2) After payment you fill in an intake questionnaire. Within 48 hours you have your calories, protein and macros, a meal plan built around the way you actually eat (restaurants included) and a training plan for your real schedule.
3) Every week you send me a 3 minute report from your phone: weight, waist, food, steps, how the week went. I answer in writing with the plan for the next week and recalculate your numbers.
4) WhatsApp Monday to Friday for everything in between: a menu before a dinner, a hotel breakfast, a week that fell apart. Answer within 24 hours. Plus one short educational guide a week.

No video calls. Everything in writing, so you have every plan, every number and every answer in one place, and you can read it again on the plane.

It's for you if you want to lose 5 to 20 kg, you eat out or travel a lot, your diets so far worked until the first business dinner, and you can write a 3 minute report once a week.

It's not for you if you want 10 kg gone in 3 weeks, if you want a fixed meal plan to follow without thinking, or if you don't want to write anything down. And if you're pregnant or breastfeeding, have an eating disorder, take medication that affects weight or have a medical condition, talk to your doctor first. I'm a coach, not a doctor.

{{price_block}}

I take a limited number of clients so I can read every report properly. Apply here: ${LINKS.apply}

Or just reply to this email with a few lines about you: age, job, how a normal week looks, what you tried. I'll tell you honestly if it makes sense, and if it doesn't, I'll tell you that too.

Want more support? Message me for VIP options.

Be Effective!
Martin`,
};

export function template(step: number, hasNumbers: boolean): Template {
  switch (step) {
    case 1: return hasNumbers ? MAIL1_NUMBERS : MAIL1_NO_NUMBERS;
    case 2: return MAIL2;
    case 3: return MAIL3;
    case 4: return MAIL4;
    case 5: return MAIL5;
    default: {
      const w = step >= 6 && step <= STEPS ? WEEKLY[step - 6] : undefined;
      if (!w) throw new Error("unknown step " + step);
      return w;
    }
  }
}

/** Dosadí {{placeholdery}}, včetně tvaru s dvojtečkou ({{link_article:SLUG}}).
 *  ⛔ Neznámý nebo nevyplněný placeholder = výjimka, mail s {{ nesmí odejít. */
export function fill(s: string, vars: Record<string, string>): string {
  const out = s.replace(/\{\{([^}]+)\}\}/g, (_, k: string) => {
    if (!(k in vars)) throw new Error("placeholder without value: " + k);
    return vars[k];
  });
  if (out.includes("{{")) throw new Error("placeholder left in text");
  return out;
}

export function cleanFirstName(raw: string | null | undefined): string {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  return s || "there";
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Escapovaný odstavec: odkazy klikací, řádky přes <br>. Interpunkce za adresou do odkazu nepatří. */
function paragraphHtml(p: string): string {
  return esc(p)
    .replace(/https?:\/\/[^\s<]+/g, (m) => {
      const trail = m.match(/[.,;:)]+$/)?.[0] ?? "";
      const url = trail ? m.slice(0, -trail.length) : m;
      // Viditelný text bez utm a tokenů (dlouhá adresa v tmavé kartě rozbíjí řádky), href plný.
      const label = url.replace(/^https?:\/\//, "").replace(/[?#].*$/, "");
      return `<a class="mb-link" href="${url}" style="color:#F6CD63">${label}</a>${trail}`;
    })
    .replace(/\n/g, "<br>\n");
}

/**
 * Stejný „kabát“ jako české maily (`drip-send` wrapHtml): tmavá karta, zlatá linka, značka
 * MARTIN BARNA, tmavá patička. Zámky barev drží tmavý vzhled i v Gmailu a Outlooku s dark mode.
 * Měníš-li vzhled, měň ho na obou stranách.
 */
function wrapHtml(subject: string, preheader: string, body: string, footerHtml: string): string {
  const FONT = "-apple-system,Segoe UI,Roboto,Arial,sans-serif";
  const LOCKS = ".mb-bg{background-color:#0C0B10!important}" +
    ".mb-card{background-color:#16131D!important}" +
    ".mb-rule{background-color:#EBB12C!important}" +
    ".mb-body{color:#F0EADF!important}" +
    ".mb-brand{color:#F6CD63!important;border-left-color:#EBB12C!important}" +
    ".mb-foot{background-color:#100E16!important}" +
    ".mb-mut{color:#A09AAD!important}" +
    ".mb-link{color:#F6CD63!important}";
  const og = (sel: string, decl: string) => `[data-ogsc] ${sel},[data-ogsb] ${sel}{${decl}}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${esc(subject)}</title>` +
    `<style>` +
    `:root{color-scheme:dark light;supported-color-schemes:dark light}` +
    `body,table,td,p,li,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}` +
    `.mb-body a,.mb-mut a{color:#F6CD63}` +
    `@media (prefers-color-scheme: dark){${LOCKS}.mb-body a,.mb-mut a{color:#F6CD63!important}}` +
    og(".mb-bg", "background-color:#0C0B10!important") +
    og(".mb-card", "background-color:#16131D!important") +
    og(".mb-rule", "background-color:#EBB12C!important") +
    og(".mb-body", "color:#F0EADF!important") +
    og(".mb-brand", "color:#F6CD63!important;border-left-color:#EBB12C!important") +
    og(".mb-foot", "background-color:#100E16!important") +
    og(".mb-mut", "color:#A09AAD!important") +
    og(".mb-link", "color:#F6CD63!important") +
    `@media only screen and (max-width:620px){.mb-pad{padding:26px 20px 22px!important}.mb-fpad{padding:16px 20px 20px!important}}` +
    `</style></head>` +
    `<body class="mb-bg" style="margin:0;padding:0;background-color:#0C0B10;background-image:linear-gradient(180deg,#17131F 0%,#0C0B10 46%,#0A0910 100%)">` +
    `<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(preheader)}</span>` +
    `<table role="presentation" class="mb-bg" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#0C0B10" style="background-color:#0C0B10;background-image:linear-gradient(180deg,#17131F 0%,#0C0B10 46%,#0A0910 100%)"><tr><td align="center" style="padding:24px 12px 30px">` +
    `<table role="presentation" class="mb-card" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#16131D" style="width:100%;max-width:600px;background-color:#16131D;border-radius:2px;border:1px solid #262231">` +
    `<tr><td class="mb-rule" bgcolor="#EBB12C" height="3" style="height:3px;line-height:3px;font-size:2px;background-color:#EBB12C">&nbsp;</td></tr>` +
    `<tr><td class="mb-body mb-pad" style="padding:30px 32px 26px;font-family:${FONT};font-size:16px;line-height:1.6;color:#F0EADF">` +
    `<div class="mb-brand" style="border-left:3px solid #EBB12C;padding-left:12px;font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#F6CD63;margin:0 0 22px">Martin Barna</div>\n` +
    body +
    `</td></tr>` +
    `<tr><td class="mb-foot mb-fpad" bgcolor="#100E16" style="padding:18px 32px 22px;background-color:#100E16;border-top:1px solid #262231">` +
    `<div class="mb-mut" style="font-family:${FONT};font-size:12px;line-height:1.55;color:#A09AAD">${footerHtml}</div>` +
    `</td></tr></table></td></tr></table></body></html>`;
}

export type RenderedMail = { subject: string; preheader: string; text: string; html: string };

export function renderEmail(step: number, v: { firstName: string | null; calc: Calc | null; unsubscribeUrl: string }): RenderedMail {
  if (!v.unsubscribeUrl) throw new Error("unsubscribe url missing");
  const t = template(step, !!v.calc);
  const vars: Record<string, string> = {
    first_name: cleanFirstName(v.firstName),
    playbook_url: LINKS.playbook,
    price_block: "",
    unsubscribe_url: v.unsubscribeUrl,
    postal_address: POSTAL_ADDRESS,
    link_apply: LINKS.apply,
    link_kit: LINKS.calculator,
  };
  if (step >= 6) {
    for (const part of [t.subject, t.preheader, t.body]) {
      for (const m of part.matchAll(/\{\{link_article:([^}]+)\}\}/g)) {
        const slug = m[1];
        vars[`link_article:${slug}`] = `${SITE}/en/blog/${slug}.html`;
      }
    }
  }
  if (v.calc) {
    vars.kcal = fmt(v.calc.kcal);
    vars.protein_g = fmt(v.calc.protein_g);
  }
  const body = fill(t.body, vars).replace(/\n{3,}/g, "\n\n").trim();
  const footer = fill(FOOTER, vars);
  const subject = fill(t.subject, vars);
  const preheader = fill(t.preheader, vars);
  const text = body + "\n\n--\n" + footer + "\n";
  const paras = body.split(/\n{2,}/).map((p) => `<p style="margin:0 0 15px">${paragraphHtml(p)}</p>`).join("\n");
  const html = wrapHtml(subject, preheader, paras, paragraphHtml(footer));
  return { subject, preheader, text, html };
}

// ---------------------------------------------------------------------------
// Odhlašovací token. ⛔ KOPIE en-unsubscribe/token.ts (shodu hlídá logic_test.ts).
// ---------------------------------------------------------------------------
export async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function deriveUnsubKey(serviceKey: string, override?: string | null): Promise<string> {
  if (override && override.length >= 16) return override;
  if (!serviceKey) return "";
  return await sha256hex("en-unsub|" + serviceKey);
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function unsubToken(email: string, key: string): Promise<string> {
  if (!key) throw new Error("unsub key missing");
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(email.trim().toLowerCase()));
  return b64url(new Uint8Array(sig));
}

export async function verifyUnsubToken(email: string, token: string, key: string): Promise<boolean> {
  if (!email || !token || !key) return false;
  const expected = await unsubToken(email, key);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

/** Odkaz v těle mailu: webová stránka s tlačítkem (GET na ní nic nemění, mailové skenery nikoho neodhlásí). */
export function unsubPageUrl(email: string, token: string): string {
  return `${SITE}/en/unsubscribe/?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`;
}

/** Hlavička List-Unsubscribe (RFC 8058 One-Click POST přímo na funkci). */
export function unsubOneClickUrl(supabaseUrl: string, email: string, token: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/en-unsubscribe?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`;
}
