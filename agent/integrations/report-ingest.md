# Auto-ingest reportů: e-mail → Drive → čitelné agentem

Cíl: aby agent dělal **data-driven check-in drafty vždy automaticky**, musí mít report (Excel) tam,
odkud ho umí číst = **Google Drive**. Týdenní reporty ale chodí jako **e-mailová příloha .xlsx**,
jejíž bajty Gmail konektor neumí stáhnout. Tenhle skript mezeru zavře.

## Jak to funguje
Apps Script běží ráno (časovač), najde maily s reportem, **uloží přílohy (.xlsx/.pdf) do Drive**
a .xlsx **převede na Google Sheet**. Agent pak ze složky čte aktuální data (`read_file_content`).
Klient nic nemění — dál posílá přílohu mailem.

## Nastavení (jednorázově, ~10 min)
1. Vytvoř v Drive složku, např. **„Reporty-inbox"**, a zkopíruj její ID z URL.
2. `script.google.com` → nový projekt → vlož kód níže → doplň `TARGET_FOLDER_ID`.
3. **Services (+) → Drive API (Advanced)** zapni (kvůli převodu xlsx → Sheet).
4. Trigger: **Triggers → Add trigger → `ingestReports` → Time-driven → Po–Pá 6:30**.
5. Spusť ručně jednou (autorizuj přístup).

## Kód
```javascript
const TARGET_FOLDER_ID = 'PASTE_FOLDER_ID'; // Drive složka "Reporty-inbox"
// chytí týdenní reporty (uprav dle svých štítků/předmětů):
const QUERY = 'newer_than:3d has:attachment (subject:report OR subject:přehled OR subject:tabulky OR "report pro coache")';

function ingestReports() {
  const folder = DriveApp.getFolderById(TARGET_FOLDER_ID);
  GmailApp.search(QUERY, 0, 50).forEach(function (t) {
    t.getMessages().forEach(function (m) {
      const stamp = Utilities.formatDate(m.getDate(), 'Europe/Prague', 'yyyy-MM-dd');
      const from = (m.getFrom().match(/[\w.+-]+@[\w.-]+/) || ['neznamy'])[0];
      m.getAttachments().forEach(function (att) {
        const nm = att.getName().toLowerCase();
        const isXlsx = nm.endsWith('.xlsx') || att.getContentType().indexOf('spreadsheet') > -1;
        const isPdf = nm.endsWith('.pdf');
        if (!isXlsx && !isPdf) return;
        const base = stamp + ' ' + from + ' ' + att.getName();
        if (folder.getFilesByName(base).hasNext()) return;          // de-dup
        if (isXlsx) {                                                // převod na Google Sheet
          Drive.Files.insert(
            { title: base.replace(/\.xlsx$/i, ''), parents: [{ id: TARGET_FOLDER_ID }], mimeType: MimeType.GOOGLE_SHEETS },
            att.copyBlob(), { convert: true });
        } else {
          folder.createFile(att.copyBlob()).setName(base);          // PDF necháme jak je
        }
      });
    });
  });
}
```

## Jak pak běží ráno (plně data-driven)
1. Skript v 6:30 nahraje dnešní reporty do „Reporty-inbox" (jako Sheety).
2. Agentovi řekneš **„projdi dnešní check-iny"** → agent složku projde, `read_file_content` každý report,
   vytáhne trend váhy/mír, Ø kcal+bílkoviny vs. cíl, kroky, vlákninu, škály (viz `../training-data/report-structure.md`),
   aplikuje logiku (`../playbooks/check-in.md`) a napíše **draft s reálnými čísly**.
3. Ty jen schválíš a odešleš.

## Alternativa bez skriptu
Nech klienty vyplňovat **jeden sdílený Google Sheet** (živý, v Drive) místo posílání .xlsx přílohy.
Pak je report vždy aktuální v Drive a agent ho čte bez skriptu. (Část klientů už sdílený odkaz používá.)

## Pozn. k dnešku
Než skript poběží, jde to i ručně: přetáhni dnešní .xlsx do „Reporty-inbox" (Drive je sám nabídne
otevřít jako Sheet) — agent je pak přečte a dodělá data-driven drafty hned.
