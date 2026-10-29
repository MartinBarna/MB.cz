// Testy uložení check-inu. Bez sítě, bez DB, bez Deno permissions.
// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/checkin-capture/ulozit.test.ts
import {
  HLASKA_CHYBA,
  jeDocasnaDb,
  stejnyCheckin,
  vlozSOpakovanim,
  type CheckinRadek,
  type DbChyba,
} from "./ulozit.ts";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) console.log("  ok   " + nazev);
  else {
    selhalo++;
    console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : ""));
  }
}

function radek(x: Partial<CheckinRadek> = {}): CheckinRadek {
  return {
    email: "klient@example.com",
    weight: 82.5,
    waist: 90,
    hips: null,
    steps: "8-10k",
    workouts: 3,
    adherence: 4,
    sleep: 3,
    feeling: 4,
    note: null,
    ...x,
  };
}

async function main(): Promise<void> {
  console.log("\n== stejný řádek ==");
  check("82.5 a \"82.50\" jsou stejná váha", stejnyCheckin(radek(), radek({ weight: "82.50" as unknown as number })));
  check("KONTRAST: jiná váha není duplicita", !stejnyCheckin(radek(), radek({ weight: 83 })));
  check("KONTRAST: jiný e-mail není duplicita", !stejnyCheckin(radek(), radek({ email: "jiny@example.com" })));

  console.log("\n== dočasná a trvalá chyba ==");
  check("timeout je dočasný", jeDocasnaDb({ code: "57014", message: "canceling statement due to statement timeout" }));
  check("502 v textu je dočasná", jeDocasnaDb({ message: "gateway 502" }));
  check("KONTRAST: unique violation je trvalá", !jeDocasnaDb({ code: "23505", message: "duplicate key" }));
  check("KONTRAST: oprávnění je trvalé", !jeDocasnaDb({ code: "42501", message: "permission denied" }));

  console.log("\n== úspěch na první pokus ==");
  {
    let vlozeni = 0;
    let cteni = 0;
    const vys = await vlozSOpakovanim(radek(), {
      najdiNedavny: async () => {
        cteni++;
        return { radek: null, chyba: null };
      },
      vloz: async () => {
        vlozeni++;
        return { radek: { ...radek(), created_at: "2026-10-29T10:00:00Z" }, chyba: null };
      },
      spi: async () => {},
    });
    check("ok a není to duplicita", vys.ok === true && vys.ok && vys.duplicita === false);
    check("insert jednou, čtení jednou", vlozeni === 1 && cteni === 1, vlozeni + "/" + cteni);
    check("vrácený řádek má created_at", vys.ok === true && !!vys.radek.created_at);
  }

  console.log("\n== dočasná chyba a pak úspěch ==");
  {
    let vlozeni = 0;
    const pauzy: number[] = [];
    const vys = await vlozSOpakovanim(radek(), {
      najdiNedavny: async () => ({ radek: null, chyba: null }),
      vloz: async () => {
        vlozeni++;
        if (vlozeni === 1) return { radek: null, chyba: { code: "57014", message: "timeout" } };
        return { radek: radek({ created_at: "2026-10-29T10:00:01Z" }), chyba: null };
      },
      cekani: [10, 20],
      spi: async (ms) => {
        pauzy.push(ms);
      },
    });
    check("po timeoutu druhý insert projde", vys.ok === true && vys.ok && !vys.duplicita);
    check("byly dva inserty a jedna pauza", vlozeni === 2 && pauzy.join(",") === "10", pauzy.join(","));
  }

  console.log("\n== dočasná chyba, řádek už ale leží: žádná druhá kopie ==");
  {
    let vlozeni = 0;
    let kolo = 0;
    const ulozeny = radek({ created_at: "2026-10-29T10:00:00Z" });
    const vys = await vlozSOpakovanim(radek(), {
      najdiNedavny: async () => {
        kolo++;
        if (kolo === 1) return { radek: null, chyba: null };
        return { radek: ulozeny, chyba: null };
      },
      vloz: async () => {
        vlozeni++;
        return { radek: null, chyba: { status: 503, message: "503" } };
      },
      cekani: [5, 5],
      spi: async () => {},
    });
    check("druhé kolo vrátí existující řádek", vys.ok === true && vys.ok && vys.duplicita === true);
    check("insert se podruhé nevolá", vlozeni === 1, String(vlozeni));
  }

  console.log("\n== trvalá chyba ==");
  {
    let vlozeni = 0;
    const vys = await vlozSOpakovanim(radek(), {
      najdiNedavny: async () => ({ radek: null, chyba: null }),
      vloz: async () => {
        vlozeni++;
        return { radek: null, chyba: { code: "23514", message: "check constraint" } as DbChyba };
      },
      spi: async () => {
        throw new Error("pauza se u trvalé chyby volat nemá");
      },
    });
    check("trvalá chyba není ok a není dočasná", vys.ok === false && vys.ok === false && vys.docasna === false);
    check("insert jen jednou", vlozeni === 1);
    check("hláška pro člověka zůstává česká a bez pomlčky", HLASKA_CHYBA === "Nepodařilo se uložit, zkus znovu" && !HLASKA_CHYBA.includes("\u2014"));
  }

  console.log("\n== tři dočasné chyby = konec bez řádku ==");
  {
    let vlozeni = 0;
    const vys = await vlozSOpakovanim(radek(), {
      najdiNedavny: async () => ({ radek: null, chyba: null }),
      vloz: async () => {
        vlozeni++;
        return { radek: null, chyba: { status: 503, message: "503" } };
      },
      cekani: [1, 1],
      spi: async () => {},
    });
    check("po třech pokusech selže jako dočasné", vys.ok === false && vys.docasna === true);
    check("tři inserty, ne víc", vlozeni === 3, String(vlozeni));
  }

  console.log(selhalo === 0 ? "\nVSE ZELENE\n" : "\n" + selhalo + " SELHANI\n");
  if (selhalo) Deno.exit(1);
}

await main();
