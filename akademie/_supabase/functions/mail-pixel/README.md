# Vlastní měření mailů (mail-pixel + mail-klik)

Projekt Supabase: **`uhmrpfsdcujbhbtumqye`** (Barna Academy).
Protějšky: `mail-klik/index.ts`, `drip-send/stopa.ts` (a jeho dvě kopie), `../../mail-mereni.sql`,
akce `mail_mereni` v `admin-api`, panel „📈 Měření mailů" v `akademie/admin/index.html`.

## Proč to existuje a čím to NENÍ

Resend click/open tracking je od 27. 7. 2026 vypnutý a Martin 28. 7. rozhodl, že se **nevrací**.
Důvod nebyl rozmar: doména `links.martinbarna.cz` vracela pět dní **400 na všechny odkazy**,
lidé končili na chybové stránce, a **události se přitom logovaly dál**, takže to nikde nekřičelo.
Tohle je náhrada, kterou celou vlastníme, a je postavená proti té zkušenosti:

- **Člověk vždycky skončí na rozumné stránce.** Když měření selže, `mail-klik` přesměruje
  i tak (v nejhorším na `https://martinbarna.cz/`). Nikdy 400, nikdy prázdná stránka.
- **Když se měření rozbije, admin to řekne sám.** Panel hlásí
  `PODEZŘENÍ_NA_VÝPADEK_MĚŘENÍ`, když se za týden posílalo a nepřišla ani jedna měřicí událost.
- **Nové typy událostí** (`px_odeslano`, `px_open`, `px_click`) se nemíchají se starými
  `open` (1313 řádků) a `click` (73 řádků) z rozbitého Resend okna.

## Co ta čísla znamenají (bez tohohle je nečti)

| metrika | směr chyby | proč |
|---|---|---|
| otevření | **nadhodnocené** | Gmail i Apple si měřicí obrázek stáhnou samy, ještě než mail někdo otevře. Přesně proto vycházel Resendu open rate 95 až 100 %. |
| opakovaná otevření | **neměří se vůbec** | Gmail si obrázek uloží k sobě (cache), druhý požadavek k nám nedojde. Měříme PRVNÍ otevření, ne počet. |
| proklik | mírně nadhodnocený | antispamové skenery proklikávají odkazy. Filtr v `admin-api` je odděluje do sloupce „z toho stroje". |

⇒ Verdikt „prodává ta nabídka?" se staví na `entitlements`, ne na těchhle číslech.

## Nasazení (přesné kroky)

1. **Migrace** (jen indexy, nic nemaže):
   ```
   psql / SQL editor: akademie/_supabase/mail-mereni.sql
   ```
2. **Secret** (jeden pro celý projekt, používají ho obě měřicí funkce i tři odesílací):
   ```
   supabase secrets set MAIL_TRACK_SECRET=<náhodných 32+ znaků> --project-ref uhmrpfsdcujbhbtumqye
   ```
   ⛔ Nikdy do gitu ani do chatu. Než je secret nastavený, odesílací funkce měření
   **tiše vynechají** a maily chodí normálně dál.
3. **Nové funkce** (obě musí být veřejné, tahá je pošta příjemce):
   ```
   supabase functions deploy mail-pixel --no-verify-jwt --project-ref uhmrpfsdcujbhbtumqye
   supabase functions deploy mail-klik  --no-verify-jwt --project-ref uhmrpfsdcujbhbtumqye
   ```
4. **Odesílací funkce** (pořadí až po kroku 3, jinak by mail nesl odkaz na neexistující funkci):
   ```
   supabase functions deploy drip-send    --no-verify-jwt --project-ref uhmrpfsdcujbhbtumqye
   supabase functions deploy milestones   --no-verify-jwt --project-ref uhmrpfsdcujbhbtumqye
   supabase functions deploy order-rescue --no-verify-jwt --project-ref uhmrpfsdcujbhbtumqye
   supabase functions deploy admin-api    --project-ref uhmrpfsdcujbhbtumqye
   ```
   ⚠️ Deploy kopíruje **celou složku**. U `drip-send` musí ve složce ležet i `aktivace.ts`,
   `pravidla.ts`, `preskoc.ts` a `stopa.ts`, jinak funkce nenaběhne.
5. **Web adminu** (`akademie/admin/index.html`) jde na Wedos ruční Action, jako každá jiná stránka.

## Ověření po nasazení (dokud tohle neproběhne, měření není hotové)

1. **Pixel musí projít Googlovou obrázkovou proxy.** Wedos vrací `GoogleImageProxy` 401 a
   obrázek z `martinbarna.cz` se v Gmailu nenačte vůbec. Pixel je proto na Supabase, ale
   ⛔ **ověřeno to zatím není**:
   ```
   curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
     -A "Mozilla/5.0 (via ggpht.com GoogleImageProxy)" \
     "https://uhmrpfsdcujbhbtumqye.supabase.co/functions/v1/mail-pixel?p=x&s=y"
   ```
   Očekává se `200 image/gif`. Cokoli jiného znamená, že otevření se nikdy nezměří.
2. **Testovací mail POUZE na `fitness.barna@gmail.com`** (`drip-send` s `test_email`
   měření záměrně nemá, takže musí jít o skutečný krok trati na testovacím leadu s adresou
   `fitness.barna+px@gmail.com`).
3. **Klikni na odkaz v DORUČENÉM mailu**, ne na odkaz z náhledu. Musí přijít 302 a správná
   cílová stránka. Pak zkontroluj:
   ```sql
   select type, detail, created_at from public.email_events
   where type like 'px\_%' order by created_at desc limit 10;
   ```
4. **Zkontroluj, že odhlašovací odkaz v tomtéž mailu vede pořád přímo na `unsubscribe`.**

## Co měření NIKDY nesmí potkat

- ⛔ **Odhlašovací odkaz se nepřepisuje.** Je to právní povinnost a zároveň obsah hlavičky
  `List-Unsubscribe`.
- ⛔ **Auth odkazy (magic link, potvrzení registrace) se nepřepisují.** Bezpečnostní token
  nemá protékat přes další redirect.
- ⛔ **`archive_bcc` a měřicí pixel se vylučují.** Resend pošle archivní kopii se stejným
  tělem, takže nese tentýž pixel, a Martinova pošta si ho stáhne už při doručení. Otevřenost
  by pak byla 100 % u všech mailů. `drip-send` proto při zapnutém `archive_bcc` pixel
  nepřilepuje a napíše to do odpovědi běhu (`stopa`).
- ⛔ **Do `email_events` se neukládá IP ani user-agent**, jen odvozený štítek klienta.
  Z ukládané URL se navíc maže hodnota parametru `email` (některé šablony ho v odkazu mají).
