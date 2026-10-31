// Endpoint C: cron odesila mail 1 a 2. Bez uplneho souhlasu se nic nerenderuje jako k odeslani
// a Resend se nevola. Dry-run Resend nevola nikdy, zapise jen kosik_dry_run.

import { chybejiciPromenne } from "../_shared/ceny.ts";
import {
  MAX_ALERTU,
  MAX_MAILU_NA_BEH,
  type KosikFlagy,
  duvodStopu,
  jeVOkne30Dni,
  maUplnySouhlas,
  mail2Po,
  posunDoOkna,
  posunKvuliPromu,
  produktEntitlement,
  rozdelPodleCastky,
  sablonaProKlic,
} from "../_shared/kosik-pravidla.ts";
import { fnSpace, odkazOdhlaseni, renderKosikMail } from "../_shared/kosik-texty.ts";

/**
 * Ktere sloupce musi byt prazdne a ktere vyplnene, aby radek sel do behu.
 * Ostry beh (dry false) vynecha radky s mail1_dry_at / mail2_dry_at:
 * suchy beh uz "odeslal" a po vypnuti dry-runu se ty maily nesmi poslat znovu.
 */
export function filtryKroku(krok: 0 | 1, dry: boolean): {
  jeNull: string[];
  neniNull: string[];
  due: "mail1_due_at" | "mail2_due_at";
} {
  if (krok === 0) {
    return {
      jeNull: ["mail1_odeslan_at", "mail1_dry_at"],
      neniNull: ["mail1_due_at"],
      due: "mail1_due_at",
    };
  }
  if (dry) {
    return {
      jeNull: ["mail1_odeslan_at", "mail2_dry_at"],
      neniNull: ["mail1_dry_at", "mail2_due_at"],
      due: "mail2_due_at",
    };
  }
  return {
    jeNull: ["mail2_odeslan_at", "mail2_dry_at"],
    neniNull: ["mail1_odeslan_at", "mail2_due_at"],
    due: "mail2_due_at",
  };
}

export type Kandidat = {
  id: string;
  created_at: string;
  email: string;
  produkt_klic: string;
  castka_halere: number;
  souhlas: boolean;
  souhlas_at: string | null;
  souhlas_text: string | null;
  souhlas_verze: string | null;
  stripe_session_id: string | null;
  test: boolean;
  zaplaceno_at: string | null;
  odpoved_at: string | null;
  odhlaseno_at: string | null;
  recovery_url: string | null;
  recovery_expires_at: string | null;
  odhlaseni_token: string;
  mail1_due_at: string | null;
  mail1_odeslan_at: string | null;
  mail1_dry_at: string | null;
  mail2_due_at: string | null;
  mail2_odeslan_at: string | null;
  mail2_dry_at: string | null;
  jmeno: string | null;
  krok: 0 | 1;
};

export type KontextRadku = {
  aktivniEntitlement: boolean;
  aktivniKoucink: boolean;
  jinaSerie: Date | null;
  dostalMarketingDnes: boolean;
  guardAkce: "send" | "skip";
  guardDuvod: string;
};

export type VysledekMailu = {
  ok: boolean;
  status: number;
  providerId: string;
  chyba?: string;
  preskoceno?: string;
};

export type PripominkaDeps = {
  ted: Date;
  flagy: KosikFlagy;
  nactiKandidaty: () => Promise<Kandidat[]>;
  kontext: (r: Kandidat) => Promise<KontextRadku>;
  oznac: (id: string, patch: Record<string, unknown>) => Promise<{ ok: boolean; chyba?: string }>;
  zapisUdalost: (detail: Record<string, unknown> & { type: string; step: number; email?: string | null }) => Promise<void>;
  posliMail: (payload: {
    to: string;
    subject: string;
    html: string;
    text: string;
    headers: Record<string, string>;
  }) => Promise<VysledekMailu>;
  alert: (predmet: string, text: string) => Promise<void>;
};

export type BehVysledek = {
  duvod?: string;
  proslo: number;
  odeslano: number;
  dry: number;
  zastaveno: number;
  alertu: number;
};

function teloMohloDojit(v: VysledekMailu): boolean {
  return v.status >= 500 || String(v.chyba ?? "").startsWith("sit:");
}

export async function zpracujPripominku(deps: PripominkaDeps): Promise<BehVysledek> {
  const vysledek: BehVysledek = { proslo: 0, odeslano: 0, dry: 0, zastaveno: 0, alertu: 0 };
  if (!deps.flagy.mailZapnuto) return { ...vysledek, duvod: "mail_vypnuto" };

  const kandidati = await deps.nactiKandidaty();
  const skupiny = rozdelPodleCastky(kandidati);
  let alertu = 0;
  const alert = async (predmet: string, text: string) => {
    if (alertu >= MAX_ALERTU) return;
    alertu++;
    vysledek.alertu = alertu;
    await deps.alert(predmet, text);
  };

  for (const skupina of skupiny) {
    if (vysledek.odeslano + vysledek.dry >= MAX_MAILU_NA_BEH) break;
    for (const vedlejsi of skupina.sloucit) {
      await deps.oznac(vedlejsi.id, { stav: "sloucen", stop_duvod: "sloucen" });
      await deps.zapisUdalost({
        type: "kosik_stop",
        step: vedlejsi.krok,
        email: vedlejsi.email,
        duvod: "sloucen",
        kosik_id: vedlejsi.id,
      });
      vysledek.zastaveno++;
    }
    const r = skupina.vitez;
    vysledek.proslo++;
    const hotovo = await zpracujRadek(r, deps, alert);
    if (hotovo === "odeslano") vysledek.odeslano++;
    else if (hotovo === "dry") vysledek.dry++;
    else vysledek.zastaveno++;
  }
  return vysledek;
}

async function zpracujRadek(
  r: Kandidat,
  deps: PripominkaDeps,
  alert: (predmet: string, text: string) => Promise<void>,
): Promise<"odeslano" | "dry" | "stop"> {
  if (!maUplnySouhlas(r)) {
    await deps.oznac(r.id, { stav: "propadlo_bez_souhlasu", stop_duvod: "bez_souhlasu" });
    await deps.zapisUdalost({
      type: "kosik_stop",
      step: r.krok,
      duvod: "bez_souhlasu",
      kosik_id: r.id,
    });
    return "stop";
  }

  const sablona = sablonaProKlic(r.produkt_klic);
  if (!sablona || !deps.flagy.produkty.includes(r.produkt_klic) || !produktEntitlement(r.produkt_klic)) {
    await deps.oznac(r.id, { stav: "stop_mimo_vlnu", stop_duvod: "mimo_vlnu" });
    await deps.zapisUdalost({
      type: "kosik_stop",
      step: r.krok,
      email: r.email,
      duvod: "mimo_vlnu",
      kosik_id: r.id,
    });
    return "stop";
  }

  const ctx = await deps.kontext(r);
  const dueRaw = r.krok === 0 ? r.mail1_due_at : r.mail2_due_at;
  const due = dueRaw ? new Date(dueRaw) : deps.ted;
  const poPromu = posunKvuliPromu(due, ctx.dostalMarketingDnes);
  if (poPromu.getTime() !== due.getTime()) {
    const sloupec = r.krok === 0 ? "mail1_due_at" : "mail2_due_at";
    await deps.oznac(r.id, { [sloupec]: poPromu.toISOString(), stop_duvod: "promo_posun" });
    await deps.zapisUdalost({
      type: "kosik_stop",
      step: r.krok,
      email: r.email,
      duvod: "promo_posun",
      kosik_id: r.id,
      due: poPromu.toISOString(),
    });
    return "stop";
  }

  const duvod = duvodStopu(r, {
    ted: deps.ted,
    aktivniEntitlement: ctx.aktivniEntitlement,
    aktivniKoucink: ctx.aktivniKoucink,
    guardAkce: ctx.guardAkce,
    guardDuvod: ctx.guardDuvod,
    dryRun: deps.flagy.dryRun,
    jinaSerieDo30Dni: jeVOkne30Dni(ctx.jinaSerie, deps.ted),
  });
  if (duvod) {
    await deps.oznac(r.id, { stav: "stop_" + duvod, stop_duvod: duvod });
    await deps.zapisUdalost({
      type: "kosik_stop",
      step: r.krok,
      email: r.email,
      duvod,
      kosik_id: r.id,
    });
    return "stop";
  }

  if (!maUplnySouhlas(r)) return "stop";

  const vars = {
    fn_space: fnSpace(r.jmeno),
    RECOVERY_URL: r.recovery_url ?? "",
    ODKAZ_ODHLASENI: odkazOdhlaseni(r.odhlaseni_token),
  };
  const mail = renderKosikMail(sablona, r.krok, vars, { kosik_garance_k1: deps.flagy.garanceK1 });
  const chybi = mail?.chybi ?? ["sablona"];
  if (!mail || chybi.length || chybejiciPromenne({ subject: mail.subject, preheader: mail.preheader, blocks: mail.html }, vars).length) {
    await deps.zapisUdalost({
      type: "kosik_stop",
      step: r.krok,
      email: r.email,
      duvod: "chybi_promenne",
      kosik_id: r.id,
      chybi: chybi.join(","),
    });
    return "stop";
  }

  if (mail.html.includes("{{") || mail.subject.includes("{{")) {
    await deps.zapisUdalost({
      type: "kosik_stop",
      step: r.krok,
      email: r.email,
      duvod: "chybi_promenne",
      kosik_id: r.id,
    });
    return "stop";
  }

  const track = "kosik-" + (produktEntitlement(r.produkt_klic) ?? r.produkt_klic);
  // Druha brana souhlasu, tesne pred zapisem dry-run i pred odeslanim.
  if (!maUplnySouhlas(r)) {
    await deps.oznac(r.id, { stav: "propadlo_bez_souhlasu", stop_duvod: "bez_souhlasu" });
    await deps.zapisUdalost({
      type: "kosik_stop",
      step: r.krok,
      duvod: "bez_souhlasu",
      kosik_id: r.id,
    });
    return "stop";
  }
  // Okno 8:00 az 20:00 Praha znovu tesne pred odeslanim. Cron mohl radek
  // sebrat driv a dobehnout az v noci. Mimo okno se due posune, mail neodejde.
  const tedVOkne = posunDoOkna(deps.ted);
  if (tedVOkne.getTime() !== deps.ted.getTime()) {
    const sloupec = r.krok === 0 ? "mail1_due_at" : "mail2_due_at";
    await deps.oznac(r.id, { [sloupec]: tedVOkne.toISOString(), stop_duvod: "mimo_okno" });
    await deps.zapisUdalost({
      type: "kosik_stop",
      step: r.krok,
      email: r.email,
      duvod: "mimo_okno",
      kosik_id: r.id,
      due: tedVOkne.toISOString(),
    });
    return "stop";
  }
  if (deps.flagy.dryRun) {
    const sloupec = r.krok === 0 ? "mail1_dry_at" : "mail2_dry_at";
    const patch: Record<string, unknown> = { [sloupec]: deps.ted.toISOString(), stav: r.krok === 0 ? "mail1_dry" : "mail2_dry" };
    if (r.krok === 0) patch.mail2_due_at = mail2Po(deps.ted).toISOString();
    const raz = await deps.oznac(r.id, patch);
    if (!raz.ok) return "stop";
    await deps.zapisUdalost({
      type: "kosik_dry_run",
      step: r.krok,
      email: r.email,
      kosik_id: r.id,
      track,
      predmet: mail.subject,
      delka_html: mail.html.length,
    });
    return "dry";
  }

  const razSloupec = r.krok === 0 ? "mail1_odeslan_at" : "mail2_odeslan_at";
  const raz = await deps.oznac(r.id, { [razSloupec]: deps.ted.toISOString(), stav: r.krok === 0 ? "mail1" : "mail2" });
  if (!raz.ok) return "stop";

  const odpoved = await deps.posliMail({
    to: r.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    headers: {
      "List-Unsubscribe": "<https://martinbarna.cz/odhlasit/?token=" + encodeURIComponent(r.odhlaseni_token) + ">",
    },
  });
  if (odpoved.preskoceno) {
    await deps.oznac(r.id, { [razSloupec]: null, stav: "stop_" + odpoved.preskoceno, stop_duvod: odpoved.preskoceno });
    await deps.zapisUdalost({
      type: "kosik_stop",
      step: r.krok,
      email: r.email,
      duvod: odpoved.preskoceno,
      kosik_id: r.id,
    });
    return "stop";
  }
  if (!odpoved.ok) {
    if (!teloMohloDojit(odpoved)) {
      await deps.oznac(r.id, { [razSloupec]: null, stav: "propadlo" });
    } else {
      await alert(
        "Kosik: nejiste odeslani",
        "Radek " + r.id + " krok " + r.krok + ". Razitko zustava, mail se neopakuje. " + (odpoved.chyba ?? ""),
      );
    }
    await deps.zapisUdalost({
      type: "odeslani_chyba",
      step: r.krok,
      email: r.email,
      kosik_id: r.id,
      track,
      status: odpoved.status,
      error: String(odpoved.chyba ?? "").slice(0, 180),
    });
    return "stop";
  }

  const patch: Record<string, unknown> = {};
  if (r.krok === 0) {
    patch.mail1_provider_id = odpoved.providerId;
    patch.mail2_due_at = mail2Po(deps.ted).toISOString();
  } else {
    patch.mail2_provider_id = odpoved.providerId;
  }
  await deps.oznac(r.id, patch);
  await deps.zapisUdalost({
    type: "odeslano",
    step: r.krok,
    email: r.email,
    kosik_id: r.id,
    track,
    provider_id: odpoved.providerId,
  });
  return "odeslano";
}
