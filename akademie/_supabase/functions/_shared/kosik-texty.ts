// Renderer mailu kosiku. Texty jsou v kosik-texty.json (generator ze zdroje 1:1).
// HTML se escapuje az tady. Flag kosik_garance_k1 pri false cely blok vynecha.

import { chybejiciPromenne } from "./ceny.ts";
import texty from "./kosik-texty.json" with { type: "json" };

export const ODESILATEL = "Martin Barna <martin@martinbarna.cz>";
export const REPLY_TO = "martin@martinbarna.cz";

export const POVOLENE_PROMENNE = ["fn_space", "RECOVERY_URL", "ODKAZ_ODHLASENI"] as const;

type BlokP = { t: "p"; text: string; flag?: string };
type BlokBtn = { t: "btn"; text: string; href: string };
type BlokPodpis = { t: "podpis"; radky: string[] };
type Blok = BlokP | BlokBtn | BlokPodpis;

export type KosikMail = {
  klic: string;
  krok: number;
  oznaceni: string;
  predmet: string;
  preheader: string;
  bloky: Blok[];
  paticka: string[];
};

export type RenderVystup = {
  subject: string;
  preheader: string;
  html: string;
  text: string;
  chybi: string[];
};

const MAILY = (texty as { maily: KosikMail[] }).maily;

export function najdiMail(klic: string, krok: number): KosikMail | null {
  return MAILY.find((m) => m.klic === klic && m.krok === krok) ?? null;
}

export function vsechnyMaily(): KosikMail[] {
  return MAILY;
}

export function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nahradToken(token: string, vars: Record<string, string>): string {
  return token in vars ? vars[token] : "{{" + token + "}}";
}

function htmlSPromennymi(sablona: string, vars: Record<string, string>): string {
  const casti = sablona.split(/(\{\{[^{}]+\}\})/g);
  return casti.map((c) => {
    const m = c.match(/^\{\{([^{}]+)\}\}$/);
    if (!m) return escHtml(c);
    const val = nahradToken(m[1], vars);
    if ((m[1] === "RECOVERY_URL" || m[1] === "ODKAZ_ODHLASENI") && val.startsWith("https://")) {
      return '<a href="' + escHtml(val) + '">' + escHtml(val) + "</a>";
    }
    return escHtml(val);
  }).join("");
}

function textSPromennymi(sablona: string, vars: Record<string, string>): string {
  return sablona.replace(/\{\{([^{}]+)\}\}/g, (_, k) => nahradToken(k, vars));
}

function blokSeVykresli(blok: Blok, flagy: { kosik_garance_k1: boolean }): boolean {
  if (blok.t === "p" && blok.flag === "kosik_garance_k1" && !flagy.kosik_garance_k1) return false;
  if (blok.t === "p" && blok.flag && blok.flag !== "kosik_garance_k1") return false;
  return true;
}

export function renderKosikMail(
  klic: string,
  krok: number,
  vars: Record<string, string>,
  flagy: { kosik_garance_k1: boolean },
): RenderVystup | null {
  const mail = najdiMail(klic, krok);
  if (!mail) return null;
  const chybi = chybejiciPromenne(
    { subject: mail.predmet, preheader: mail.preheader, blocks: [...mail.bloky, { paticka: mail.paticka }] },
    vars,
  );
  const subject = textSPromennymi(mail.predmet, vars);
  const preheader = textSPromennymi(mail.preheader, vars);
  const htmlCasti: string[] = [];
  const textCasti: string[] = [];
  htmlCasti.push(
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + escHtml(preheader) + "</div>",
  );
  for (const blok of mail.bloky) {
    if (!blokSeVykresli(blok, flagy)) continue;
    if (blok.t === "p") {
      htmlCasti.push('<p style="margin:0 0 14px">' + htmlSPromennymi(blok.text, vars) + "</p>");
      textCasti.push(textSPromennymi(blok.text, vars));
    } else if (blok.t === "btn") {
      const href = textSPromennymi(blok.href, vars);
      htmlCasti.push(
        '<p style="margin:18px 0"><a href="' + escHtml(href) + '" style="display:inline-block;background:#EBB12C;color:#1A1222;font-weight:700;padding:12px 18px;border-radius:999px;text-decoration:none">'
          + escHtml(blok.text) + "</a></p>",
      );
      textCasti.push(blok.text + ": " + href);
    } else {
      htmlCasti.push(
        '<p style="margin:18px 0 0"><strong>' + escHtml(blok.radky[0]) + "</strong><br>"
          + escHtml(blok.radky[1]) + "</p>",
      );
      textCasti.push(blok.radky.join("\n"));
    }
  }
  htmlCasti.push('<hr style="border:none;border-top:1px solid #e4dccf;margin:22px 0">');
  for (const radek of mail.paticka) {
    htmlCasti.push('<p style="margin:0 0 8px;font-size:12px;line-height:1.45;color:#5c564c">' + htmlSPromennymi(radek, vars) + "</p>");
    textCasti.push(textSPromennymi(radek, vars));
  }
  const html = '<!doctype html><html lang="cs"><body style="margin:0;padding:20px;font-family:Arial,sans-serif;color:#1a1222;line-height:1.5">'
    + htmlCasti.join("") + "</body></html>";
  return { subject, preheader, html, text: textCasti.join("\n\n"), chybi };
}

export function odkazOdhlaseni(token: string): string {
  return "https://martinbarna.cz/odhlasit/?token=" + encodeURIComponent(token);
}

export function fnSpace(jmeno: string | null | undefined): string {
  const j = String(jmeno ?? "").trim();
  if (!j) return "";
  return " " + j.split(/\s+/)[0];
}
