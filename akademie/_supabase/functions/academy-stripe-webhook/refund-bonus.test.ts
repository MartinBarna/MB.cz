// =============================================================================
// Testy jádra `refund-bonus.ts`: který bonusový videokurz smí sebrat refund.
// Spuštění: npx deno run --no-check -A refund-bonus.test.ts
//
// ⚠️ CO TÍMHLE NENÍ OVĚŘENÉ: samotné SQL filtry (`product`, `active`) v `index.ts`.
//    Mock je dodržuje, ale test je nespouští. Ověřená je logika, ne dotaz.
// =============================================================================
import {
  type BonusKandidat,
  bezBonusuAppky,
  jeBonusAppky,
  najdiBonusyAppky,
  ZDROJE_BONUS_APPKA,
} from "./refund-bonus.ts";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) console.log("  ok   " + nazev);
  else { selhalo++; console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : "")); }
}

/** Falešná tabulka `entitlements`. Dotazy dodržují stejné filtry jako `index.ts`. */
type Radek = BonusKandidat & { active: boolean };
function depsZTabulky(tabulka: Radek[]) {
  return {
    podleZakaznika: (cus: string) =>
      Promise.resolve(
        tabulka.filter((r) => r.stripe_customer_id === cus && r.product === "videokurz" && r.active),
      ),
    podleMailu: (mail: string) =>
      Promise.resolve(
        tabulka.filter((r) => r.email === mail && r.product === "videokurz" && r.active),
      ),
  };
}

const BONUS_S_KLICEM: Radek = {
  email: "k@example.com", product: "videokurz", source: "prvni-platba-bonus",
  stripe_customer_id: "cus_APPKA", active: true,
};
const BONUS_LEGACY: Radek = {
  email: "k@example.com", product: "videokurz", source: "prvni-platba-bonus",
  stripe_customer_id: null, active: true,
};
const KOUPENY_VIDEOKURZ: Radek = {
  email: "k@example.com", product: "videokurz", source: "stripe-videokurz",
  stripe_customer_id: null, active: true,
};

async function main(): Promise<void> {
  console.log("\n== refund-bonus: bonusovy videokurz z appky ==");

  // --- 1) Refund appky, který nese payment_intent i zákazníka -----------------
  // Bonusový řádek payment intent SCHVÁLNĚ nemá (R3), takže se páruje zákazník.
  {
    const { bonusy, podle } = await najdiBonusyAppky(
      { castecny: false, zakaznik: "cus_APPKA", emailZPlatby: "k@example.com" },
      depsZTabulky([BONUS_S_KLICEM]),
    );
    check("1) refund appky s payment_intent: bonus nalezen podle zakaznika",
      bonusy.length === 1 && podle === "stripe_customer_id", podle);
  }

  // --- 2) Refund appky bez payment_intent, jen se zákazníkem ------------------
  {
    const { bonusy, podle } = await najdiBonusyAppky(
      { castecny: false, zakaznik: "cus_APPKA", emailZPlatby: "" },
      depsZTabulky([BONUS_S_KLICEM]),
    );
    check("2) bez payment_intent, podle zakaznika: bonus nalezen",
      bonusy.length === 1 && podle === "stripe_customer_id", podle);
  }

  // --- 3) Legacy řádek bez obojího: bere ho až e-mailová větev ----------------
  {
    const { bonusy, podle } = await najdiBonusyAppky(
      { castecny: false, zakaznik: "cus_JINY", emailZPlatby: "k@example.com" },
      depsZTabulky([BONUS_LEGACY]),
    );
    check("3) legacy radek bez klice: nalezen podle e-mailu",
      bonusy.length === 1 && podle.startsWith("e-mail"), podle);
  }
  {
    // ⛔ R2: kdo klíč MÁ a nesedí, patří k jiné platbě. Refund cizího produktu
    //    mu bonus brát nesmí, i když je zadarmo: appku dál platí.
    const { bonusy } = await najdiBonusyAppky(
      { castecny: false, zakaznik: "cus_JINY", emailZPlatby: "k@example.com" },
      depsZTabulky([BONUS_S_KLICEM]),
    );
    check("3b) bonus s CIZIM klicem se podle e-mailu NEBERE", bonusy.length === 0,
      JSON.stringify(bonusy));
  }

  // --- 4) Zaplacený videokurz vedle bonusu: zaplacený zůstane -----------------
  {
    const { bonusy } = await najdiBonusyAppky(
      { castecny: false, zakaznik: "", emailZPlatby: "k@example.com" },
      depsZTabulky([KOUPENY_VIDEOKURZ, BONUS_LEGACY]),
    );
    check("4) e-mail se zaplacenym i bonusovym kurzem: bere se jen bonus",
      bonusy.length === 1 && bonusy[0].source === "prvni-platba-bonus",
      JSON.stringify(bonusy));
    check("4b) zaplaceny kurz neni bonus appky", !jeBonusAppky(KOUPENY_VIDEOKURZ));
  }

  // --- 5) Refund Academy členství: bonusu appky se nedotkne ------------------
  // Hlavní párování Academy řádek najde, bonusová větev se vůbec nespustí. Tady
  // se testuje ten filtr, kterým se to zajistí (R1).
  {
    const radky = [
      { product: "academy", source: "stripe-monthly" },
      { product: "videokurz", source: "prvni-platba-bonus" },
    ];
    const zbylo = bezBonusuAppky(radky);
    check("5) hlavni parovani: bonus appky vyhozen, Academy zustava",
      zbylo.length === 1 && zbylo[0].product === "academy", JSON.stringify(zbylo));
  }
  {
    // A obráceně: samotný bonus hlavní párování NESMÍ vzít (jinak by odešel
    // rozlučkový mail o Academy a Academy by rušila appčí předplatné).
    const zbylo = bezBonusuAppky([{ product: "videokurz", source: "appka-vip" }]);
    check("5b) samotny bonus hlavni parovani nevezme", zbylo.length === 0);
    check("5c) zaplaceny videokurz hlavni parovani VEZME",
      bezBonusuAppky([{ product: "videokurz", source: "stripe-videokurz" }]).length === 1);
    check("5d) bonus ke konzultaci hlavni parovani VEZME (ma vlastni vetev)",
      bezBonusuAppky([{ product: "videokurz", source: "konzultace-bonus" }]).length === 1);
  }

  // --- Částečný refund neodebírá nic ----------------------------------------
  {
    const { bonusy } = await najdiBonusyAppky(
      { castecny: true, zakaznik: "cus_APPKA", emailZPlatby: "k@example.com" },
      depsZTabulky([BONUS_S_KLICEM]),
    );
    check("castecny refund: neodebira nic", bonusy.length === 0);
  }

  // --- Seznam zdrojů drží to, co umí vyrobit most i grant funkce (R4) --------
  {
    check("R4: seznam zdroju obsahuje prvni-platba-bonus",
      ZDROJE_BONUS_APPKA.includes("prvni-platba-bonus"));
    check("R4: seznam zdroju obsahuje rocni-vip-bonus",
      ZDROJE_BONUS_APPKA.includes("rocni-vip-bonus"));
    check("R4: seznam zdroju obsahuje appka-vip", ZDROJE_BONUS_APPKA.includes("appka-vip"));
    check("R4: seznam NEobsahuje zaplacene ani rucni zdroje",
      !ZDROJE_BONUS_APPKA.includes("stripe-videokurz") &&
      !ZDROJE_BONUS_APPKA.includes("simpleshop") &&
      !ZDROJE_BONUS_APPKA.includes("admin-panel") &&
      !ZDROJE_BONUS_APPKA.includes("wordpress-import") &&
      !ZDROJE_BONUS_APPKA.includes("konzultace-bonus"));
  }

  console.log(selhalo === 0 ? "\nVSE ZELENE\n" : "\n" + selhalo + " SELHANI\n");
  if (selhalo > 0) throw new Error(String(selhalo) + " selhani");
}

await main();
