// Testy čistého výběru academy-delete-account.
// Spuštění: npx --yes deno@2 run akademie/_supabase/functions/academy-delete-account/vyber.test.ts
// (bez --allow-*: test nečte síť, disk ani proměnné prostředí)
import {
  chybiTabulka,
  escapeIlikeExact,
  jeDuplicita,
  jeMesicniClenstvi,
  jePouzitelnyEmail,
  jeStripeSubscriptionId,
  SMAZAT_CLIENT_EMAIL,
  SMAZAT_EMAIL,
  SMAZAT_USER_EMAIL,
  SMAZAT_USER_ID,
} from "./vyber.ts";

let selhalo = 0;
function check(nazev: string, podminka: boolean, detail = ""): void {
  if (podminka) {
    console.log("  ok   " + nazev);
  } else {
    selhalo++;
    console.log("  FAIL " + nazev + (detail ? "  [" + detail + "]" : ""));
  }
}

check(
  "mesicni clenstvi s sub id se rusi",
  jeMesicniClenstvi({ source: "stripe-monthly", stripe_subscription_id: "sub_123abc" }),
);
check(
  "dozivotni radek se starym sub id se nerusi",
  !jeMesicniClenstvi({ source: "stripe-lifetime", stripe_subscription_id: "sub_123abc" }),
);
check(
  "videokurz z appky (cizi sub id) se nerusi",
  !jeMesicniClenstvi({ source: "app-bonus", stripe_subscription_id: "sub_app123" }),
);
check(
  "prazdne sub id se nerusi",
  !jeMesicniClenstvi({ source: "stripe-monthly", stripe_subscription_id: "" }),
);
check(
  "mezery misto id se nerusi",
  !jeMesicniClenstvi({ source: "stripe-monthly", stripe_subscription_id: "   " }),
);
check(
  "null id se nerusi",
  !jeMesicniClenstvi({ source: "stripe-monthly", stripe_subscription_id: null }),
);
check("null radek se nerusi", !jeMesicniClenstvi(null));

check("sub_ id je stripe subscription", jeStripeSubscriptionId("sub_123abc"));
check("payment intent neni subscription", !jeStripeSubscriptionId("pi_123"));
check("prazdne id neni subscription", !jeStripeSubscriptionId(""));
check("id s lomitkem se odmitne", !jeStripeSubscriptionId("sub_12/../x"));

check(
  "podtrzitko v e-mailu neni wildcard",
  escapeIlikeExact("a_b@x.com") === "a\\_b@x.com",
  escapeIlikeExact("a_b@x.com"),
);
check(
  "procento v e-mailu neni wildcard",
  escapeIlikeExact("100%@x.com") === "100\\%@x.com",
);
check(
  "zpetne lomitko se escapuje driv nez podtrzitko",
  escapeIlikeExact("a\\_b@x.com") === "a\\\\\\_b@x.com",
  escapeIlikeExact("a\\_b@x.com"),
);

check("normalni e-mail projde", jePouzitelnyEmail("a@b.cz"));
check("prazdny e-mail neprojde", !jePouzitelnyEmail(""));
check("bez zavinace neprojde", !jePouzitelnyEmail("nejsem-email"));
check("carka neprojde", !jePouzitelnyEmail("a,b@x.com"));
check("mezera neprojde", !jePouzitelnyEmail("a b@x.com"));

check("42P01 je chybejici tabulka", chybiTabulka({ code: "42P01", message: "x" }));
check("PGRST205 je chybejici tabulka", chybiTabulka({ code: "PGRST205", message: "schema cache" }));
check("chyba sloupce neni chybejici tabulka", !chybiTabulka({ code: "42703", message: "column email does not exist" }));
check("text o sloupci bez kodu neni chybejici tabulka", !chybiTabulka({ message: "column email does not exist" }));
check(
  "relation does not exist bez kodu je chybejici tabulka",
  chybiTabulka({ message: 'relation "public.kosik_checkouty" does not exist' }),
);
check("null neni chybejici tabulka", !chybiTabulka(null));

check("23505 je duplicita", jeDuplicita({ code: "23505", message: "ok" }));
check("unique v texte je duplicita", jeDuplicita({ message: "duplicate key value violates unique constraint" }));
check("jina chyba neni duplicita", !jeDuplicita({ code: "42501", message: "permission denied" }));

const zakaz = [
  "entitlements",
  "referrals",
  "referral_payouts",
  "referral_codes",
  "discount_credits",
  "profiles",
  "progress",
  "certificates",
  "koucink_konec_sent",
  "client_remind_sent",
  "tydenik_odeslani",
  "en_mail_log",
  "en_unsubscribes",
  "odhlaseni_trvale",
  "customer_contacts",
  "leads",
  "email_events",
  "crm_persons",
  "withdrawals",
  "kosik_checkouty",
];
const maze = new Set<string>([...SMAZAT_EMAIL, ...SMAZAT_CLIENT_EMAIL]);
for (const t of zakaz) {
  check(t + " neni v obecnem mazacim seznamu", !maze.has(t));
}
for (const t of ["client_reports", "client_intake", "test_attempts"]) {
  check(t + " se maze podle emailu", (SMAZAT_EMAIL as readonly string[]).includes(t));
}
for (const t of ["ai_flags", "ai_usage", "test_attempts"]) {
  check(t + " se maze podle user_id", (SMAZAT_USER_ID as readonly string[]).includes(t));
}
check("ai_flags se maze podle user_email", (SMAZAT_USER_EMAIL as readonly string[]).includes("ai_flags"));
for (const t of zakaz) {
  check(t + " neni v mazani podle user_id", !(SMAZAT_USER_ID as readonly string[]).includes(t));
}
check("seznamy nejsou prazdne", SMAZAT_EMAIL.length > 0 && SMAZAT_CLIENT_EMAIL.length === 2);

if (selhalo > 0) throw new Error(String(selhalo) + " selhani");
console.log("vsechny testy prosly");
