// Pozvánka na první check-in do uvítacího mailu po nákupu videokurzu.
// drip-send ji vloží při renderu tratě onboarding-nakup-videokurz, krok 0.
// Šablona v email_templates se nemění a nikomu, kdo mail už dostal, se neposílá znovu
// (drip má deduplikaci sent na lead + krok). Žádné utm. Žádná dávka na staré kupce.

export const TRACK_NAKUP_VIDEOKURZ = "onboarding-nakup-videokurz";
export const KROK_UVITANI = 0;
export const ODKAZ_CHECKIN = "https://martinbarna.cz/akademie/check-in/";
export const TEXT_TLACITKA = "Vyplnit první check-in";
export const TEXT_POZVANKY =
  "A ještě jedna věc, než se pustíš do lekcí. Vyplň si <strong>první check-in</strong>. " +
  "Zabere to 30 vteřin: naklikáš váhu a jak se cítíš, a hned dostaneš doporučení na míru na další týden. " +
  "Za každý další se ti po troškách načítá sleva.";

export type BlokPozvanky = {
  t: string;
  html?: string;
  href?: string;
  text?: string;
  items?: string[];
};

export function doplnPozvankuCheckinu<T extends BlokPozvanky>(
  track: string,
  step: number,
  blocks: T[] | null | undefined,
): T[] {
  const vstup = Array.isArray(blocks) ? blocks.slice() : [];
  if (track !== TRACK_NAKUP_VIDEOKURZ || Number(step) !== KROK_UVITANI) return vstup;
  if (JSON.stringify(vstup).includes("/akademie/check-in")) return vstup;
  const nove = [
    { t: "p", html: TEXT_POZVANKY },
    { t: "btn", href: ODKAZ_CHECKIN, text: TEXT_TLACITKA },
  ] as T[];
  const zaver = vstup.findIndex((b) => b.t === "p" && String(b.html ?? "").startsWith("Kdyby cokoliv nešlo"));
  if (zaver >= 0) return [...vstup.slice(0, zaver), ...nove, ...vstup.slice(zaver)];
  const ps = vstup.findIndex((b) => b.t === "ps");
  if (ps >= 0) return [...vstup.slice(0, ps), ...nove, ...vstup.slice(ps)];
  return [...vstup, ...nove];
}
