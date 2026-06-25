/* ============================================================
   BARNA ACADEMY — Supabase konfigurace (VZOR)
   ------------------------------------------------------------
   1) Zkopíruj tento soubor jako  /assets/ba-config.js
   2) Doplň URL a ANON (public) klíč ze Supabase:
      Dashboard → Project Settings → API → Project URL + anon public key
   3) NIKDY sem nedávej service_role / secret klíč! Sem patří jen anon.
   Dokud /assets/ba-config.js neexistuje, web jede v „demo" režimu
   (postup v localStorage, vše odemčeno) a nic se nerozbije.
   ============================================================ */
window.BA_CONFIG = {
  url: "https://YOUR-PROJECT.supabase.co",
  anonKey: "YOUR-ANON-PUBLIC-KEY"
};
