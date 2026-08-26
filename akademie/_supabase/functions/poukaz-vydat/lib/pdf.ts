// =============================================================================
// poukaz-vydat: PDF poukazu NAKRESLENÉ OD NULY přes pdf-lib (žádný headless
// prohlížeč, žádné předrenderované PNG pozadí). Design vychází z
// _Claude-dokumenty/poukaz-generator/poukaz.html (tmavé pozadí, zlaté akcenty,
// Poppins), ale layout je zjednodušený na to, co jde spolehlivě spočítat bez
// živého DOM měření:
//   - Tři vzhledy: výchozí tmavá (bg #161616, zlaté akcenty), světlá na tisk
//     (krémově bílé pozadí, tmavší zlatá kvůli kontrastu) a slavnostní (hlubší
//     tmavá s fialovým nádechem, dvojitý rám, značky na všech čtyřech rozích).
//     Texty na poukazu se nemění, jen barvy a dekorace. Parametr `vzhled`
//     z Stripe dropdown pole, neznámá hodnota padá na tmavou.
//   - Rastrové logo se NEKRESLÍ. Identita je textová („MARTIN BARNA"
//     wordmark), stejně jako kicker v původním designu. Přidávat logo jako
//     embedovaný PNG by zdvojnásobilo velikost bundlu za cenu, kterou nikdo
//     nežádal, jednoduchost první (CLAUDE.md bod 2).
//   - ŽÁDNÉ živé auto-zmenšování (to dělal JS/DOM v poukaz.html přes
//     scrollHeight, tady nic takového není). Místo toho PEVNÉ limity délky
//     (viz LIMITS) a měřené zalamování/ořez přes font.widthOfTextAtSize:
//     delší vstup se ořízne třemi tečkami, nikdy nepřeteče přes okraj stránky.
// =============================================================================

import { PDFDocument, PDFFont, rgb, type RGB } from 'https://esm.sh/pdf-lib@1.17.1';
// esm.sh vygeneroval pro tenhle CJS balíček typy BEZ default exportu, i když
// za běhu (ESM interop) default export existuje. `import fontkit from …`
// proto spadne na `deno check` (TS1192), ne za běhu. Obejito namespace
// importem a přetypováním, runtime shape se ověřuje testem __tests__/pdf.test.ts.
import * as fontkitNs from 'https://esm.sh/@pdf-lib/fontkit@1.1.1';
const fontkit = (fontkitNs as unknown as { default: typeof fontkitNs }).default ?? fontkitNs;

import {
  POPPINS_REGULAR_B64,
  POPPINS_SEMIBOLD_B64,
  POPPINS_BOLD_B64,
  POPPINS_EXTRABOLD_B64,
} from './fonts-data.ts';

// A4 na šířku v bodech (1 mm = 2.834645669 pt; 297×210 mm).
const PAGE_W = 841.89;
const PAGE_H = 595.28;

const MARGIN = 40; // okraj stránky → rámeček
const PAD = 32; // rámeček → obsah
const CORNER = 34; // délka rohové značky
// Dech mezi páskem (kód/platnost/uplatnění) a patičkou s podpisem pod ním
// (Martinův požadavek 25. 8. 2026: podpis byl nalepený na box i na rám).
const FOOTER_GAP = 16;

export type VoucherVzhled = 'tmava' | 'svetla' | 'slavnostni';
export const DEFAULT_VZHLED: VoucherVzhled = 'tmava';

// Martin založil Stripe dropdown pole `vzhledpoukazu` 26. 8. 2026 ručně a Stripe
// si `value` každé volby vygeneroval samo z LABELU se zahozenou diakritikou
// a mezerami (ne z kanonických hodnot, které jsme čekali) - změřeno v API logu:
// "Tmavá zlatá" → `tmavzlat`, "Světlá na tisk" → `svtlnatisk`,
// "Slavnostní" → `slavnostn`. Mapa tyhle SYROVÉ Stripe hodnoty překládá na
// kanonické, kanonické (`tmava`/`svetla`/`slavnostni`) dál fungují taky (testy,
// budoucí přímé volání `buildVoucherPdf`).
const STRIPE_RAW_VZHLED: Record<string, VoucherVzhled> = {
  tmavzlat: 'tmava',
  svtlnatisk: 'svetla',
  slavnostn: 'slavnostni',
};

/** Neznámá / chybějící hodnota VŽDY padne na tmavou. Nikdy nehodí chybu. */
export function normalizeVzhled(v: string | null | undefined): VoucherVzhled {
  if (v === 'svetla' || v === 'slavnostni' || v === 'tmava') return v;
  if (v != null && STRIPE_RAW_VZHLED[v]) return STRIPE_RAW_VZHLED[v];
  return DEFAULT_VZHLED;
}

type Palette = Record<
  'bg' | 'frame' | 'acc' | 'accLight' | 'cream' | 'white' | 'muted' | 'band' | 'bandLine',
  RGB
>;

function rgba(r: number, g: number, b: number, a: number, bg: RGB): RGB {
  // pdf-lib nemá alpha pro fill barvy jednoduše všude použitelnou; místo
  // průhlednosti mísíme barvu proti pozadí stránky ručně (stejný vizuální
  // efekt jako `rgba(255,255,255,.045)` na #161616 podkladu, ale funguje
  // i na světlém bg u vzhledu `svetla`).
  const mix = (c: number, bgc: number) => bgc + (c / 255 - bgc) * a;
  return rgb(mix(r, bg.red), mix(g, bg.green), mix(b, bg.blue));
}

function paletteFor(vzhled: VoucherVzhled): Palette {
  if (vzhled === 'svetla') {
    const bg = rgb(0xfa / 255, 0xf8 / 255, 0xf4 / 255);
    return {
      bg,
      frame: rgba(0xeb, 0xb1, 0x2c, 0.62, bg),
      // Nález nezávislé revize (Cursor, 25. 8. 2026): #a8790f na bg #faf8f4 mělo
      // jen ~3.7:1 kontrastu, pod WCAG AA (4.5:1) na 7.5pt labelech. #6b4e00
      // dává ~7.3:1, bezpečná rezerva i pro slabší tiskárnu.
      acc: rgb(0x6b / 255, 0x4e / 255, 0x00 / 255),
      accLight: rgb(0x8a / 255, 0x65 / 255, 0x10 / 255),
      cream: rgb(0x22 / 255, 0x1f / 255, 0x1a / 255),
      white: rgb(0x1a / 255, 0x18 / 255, 0x14 / 255),
      muted: rgb(0x6b / 255, 0x63 / 255, 0x58 / 255),
      band: rgba(0xeb, 0xb1, 0x2c, 0.08, bg),
      bandLine: rgba(0xa8, 0x79, 0x0f, 0.38, bg),
    };
  }
  if (vzhled === 'slavnostni') {
    const bg = rgb(0x0c / 255, 0x0b / 255, 0x10 / 255);
    return {
      bg,
      frame: rgba(0xeb, 0xb1, 0x2c, 0.48, bg),
      acc: rgb(0xeb / 255, 0xb1 / 255, 0x2c / 255),
      accLight: rgb(0xf6 / 255, 0xcd / 255, 0x63 / 255),
      cream: rgb(0xf0 / 255, 0xea / 255, 0xdf / 255),
      white: rgb(1, 1, 1),
      muted: rgb(0xc2 / 255, 0xb8 / 255, 0xa8 / 255),
      band: rgba(0xeb, 0xb1, 0x2c, 0.08, bg),
      bandLine: rgba(0xeb, 0xb1, 0x2c, 0.22, bg),
    };
  }
  const bg = rgb(0x16 / 255, 0x16 / 255, 0x16 / 255);
  return {
    bg,
    frame: rgba(0xeb, 0xb1, 0x2c, 0.32, bg),
    acc: rgb(0xeb / 255, 0xb1 / 255, 0x2c / 255),
    accLight: rgb(0xf6 / 255, 0xcd / 255, 0x63 / 255),
    cream: rgb(0xf0 / 255, 0xea / 255, 0xdf / 255),
    white: rgb(1, 1, 1),
    muted: rgb(0xc2 / 255, 0xb8 / 255, 0xa8 / 255),
    band: rgba(0xff, 0xff, 0xff, 0.045, bg),
    bandLine: rgba(0xff, 0xff, 0xff, 0.14, bg),
  };
}

// Pevné limity délky vstupu, místo živého auto-zmenšování z poukaz.html.
// Delší vstup se ořízne (viz truncateToWidth/wrapAndClamp), nikdy nepřeteče.
export const LIMITS = {
  recipientNameMaxChars: 70,
  whatTextMaxChars: 600,
  whatTextMaxLines: 5,
};

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Ořízne text na šířku `maxWidth` (v bodech) a přidá „…", pokud se nevejde. */
export function truncateToWidth(font: PDFFont, text: string, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const ell = '…';
  let lo = 0;
  let hi = text.length;
  // binární hledání nejdelšího prefixu, který se s '…' vejde
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid).trimEnd() + ell;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd() + ell;
}

/** Jako truncateToWidth, ale VŽDY vrátí text končící '…', i když se `text`
 *  samotný do `maxWidth` vejde beze zbytku (truncateToWidth by ho v tom
 *  případě vrátil beze změny, správně pro samostatné volání, ale špatně
 *  jako "poslední řádek zalomeného textu, kde vím, že něco chybí"). */
function forceEllipsis(font: PDFFont, text: string, size: number, maxWidth: number): string {
  let s = text;
  while (s.length > 0 && font.widthOfTextAtSize(s + '…', size) > maxWidth) {
    s = s.slice(0, -1);
  }
  return s.trimEnd() + '…';
}

/** Greedy zalamování na slova; nad `maxLines` řádků zbytek ořízne s „…" na posledním řádku.
 *  `alreadyCut` řekni `true`, když `text` sám vznikl tvrdým znakovým ořezem delšího vstupu
 *  (LIMITS.whatTextMaxChars), bez toho by zalomení nemělo jak poznat, že mimo VIDITELNÝCH
 *  řádků chybí ještě něco, protože už-ořezaný text se do maxLines běžně vejde celý beze
 *  zbytku (viz feedback v komentáři níž o skutečné příčině chybějící '…'). */
export function wrapAndClamp(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
  maxLines: number,
  alreadyCut = false,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? current + ' ' + word : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = '';
    if (lines.length >= maxLines) break;
    // Nález nezávislé revize (Cursor, 25. 8. 2026): jedno slovo BEZ mezer
    // delší než `maxWidth` (žádné místo, kde ho zalomit) by se jinak jako
    // `current` dostalo do dalšího kola a nakonec vykreslilo přetečené přes
    // rámeček poukazu. Ať se to nestane, dostane vlastní řádek a tvrdě se
    // ořízne (přesně jako `truncateToWidth` u jména).
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      lines.push(truncateToWidth(font, word, size, maxWidth));
      if (lines.length >= maxLines) break;
      continue;
    }
    current = word;
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length > maxLines) lines.length = maxLines;

  // Pokud po zalomení ještě něco zbývá (nevešlo se do maxLines), NEBO byl
  // vstup už PŘED voláním tvrdě uříznutý na znaky (alreadyCut), v obou
  // případech poslední řádek MUSÍ dostat '…' (forceEllipsis). ⛔ Bez
  // `alreadyCut` by znakově uříznutý text (LIMITS.whatTextMaxChars), který
  // se do maxLines vejde celý beze zbytku, prošel jako "nic nechybí" a
  // ellipsis by tiše zmizela, i když text reálně byl uprostřed slova uříznut
  // ještě PŘED touhle funkcí. Přesně tahle chyba prošla prvním testem i
  // vizuální kontrolou prvního vzorku, teprve druhý vzorek ji odhalil.
  const consumedWords = lines.join(' ').split(/\s+/).length;
  const wrapDroppedWords = consumedWords < words.length && lines.length === maxLines;
  // alreadyCut platí bez ohledu na to, na kolik řádků se zbytek vešel: znaky
  // zmizely PŘED touhle funkcí, takže poslední řádek dostane '…' vždycky.
  if ((wrapDroppedWords || alreadyCut) && lines.length > 0) {
    const last = lines.length - 1;
    lines[last] = forceEllipsis(font, lines[last], size, maxWidth);
  }
  return lines;
}

function letterSpaced(s: string, gap = ' '): string {
  return s.split('').join(gap);
}

// ⛔ Nálezy nezávislé revize (Cursor, 25. 8. 2026): jméno se sice délkově
// ořízne, ale `\n`/`\r`/tab v něm nechytí nic, a pdf-lib na newline uvnitř
// `drawText` hází výjimku (voucher spadne do 'chyba', mail nedojde). Vstup
// jako "Jan\nNovák" je pod limitem 70 znaků, takže by prošel beze změny.
// Ořízne se tu jakýkoli řídicí znak (C0 + DEL) PŘED čímkoli dalším.
function sanitizeText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ').trim();
}

export type VoucherPdfInput = {
  /** Jméno obdarovaného. Prázdné/chybějící volající nahradí za 'pro tebe' PŘED voláním. */
  recipientName: string;
  /** Text co poukaz obsahuje (z `poukaz_varianty.nazev_na_poukaz`). */
  whatText: string;
  code: string;
  /** Už naformátováno v Europe/Prague (core.ts), ne syrové Date: viz feedback
   *  "datum podle UTC, ne podle Česka" (Cursor revize, nález 10). Formátování
   *  data patří na jedno místo, ne do dvou funkcí zvlášť. */
  validUntilCzech: string;
  issuedAtCzech: string;
  /** Stripe dropdown `vzhledpoukazu`. Volitelné: starší volání ho neposílají. */
  vzhled?: string;
};

export async function buildVoucherPdf(rawInput: VoucherPdfInput): Promise<Uint8Array> {
  const vzhled = normalizeVzhled(rawInput.vzhled);
  const COL = paletteFor(vzhled);
  const input = {
    ...rawInput,
    recipientName: sanitizeText(rawInput.recipientName),
    whatText: sanitizeText(rawInput.whatText),
  };
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [regular, semibold, bold, extrabold] = await Promise.all([
    pdfDoc.embedFont(b64ToBytes(POPPINS_REGULAR_B64), { subset: true }),
    pdfDoc.embedFont(b64ToBytes(POPPINS_SEMIBOLD_B64), { subset: true }),
    pdfDoc.embedFont(b64ToBytes(POPPINS_BOLD_B64), { subset: true }),
    pdfDoc.embedFont(b64ToBytes(POPPINS_EXTRABOLD_B64), { subset: true }),
  ]);

  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: COL.bg });

  // Martinovo QA 25. 8. 2026 (druhé kolo): tmavá a slavnostní se od sebe lišily
  // jen jemně (dvojitý rám), na první pohled nepoznat. Slavnostní teď dostává
  // navíc: plnou zlatou stužku na levém okraji, zlatý pruh nad kódovým boxem
  // a zlatou pečeť s monogramem MB (viz níž) - všechno stejnou brand zlatou
  // (#ebb12c), žádná cizí barva.
  // ⛔ Třetí kolo QA (Martin): tady dřív bylo ještě "glow" pozadí (stackované
  // poloprůhledné pruhy shora dolů). Vyrábělo TVRDÝ šev v půlce stránky, ne
  // plynulý přechod - `rgba()` mísí barvu vždy proti `COL.bg`, ne proti barvě
  // pod sebou, takže překrývající se obdélníky s KLESAJÍCÍM alpha (menší
  // nahoře, méně sytý) vytvořily neplynulé, dokonce obrácené pásmo s ostrou
  // hranou na okraji největšího obdélníku. pdf-lib nemá nativní gradient fill
  // bez ruční práce s PDF content streamem, což by pro tenhle efekt bylo
  // neúměrně složité (CLAUDE.md bod 2, jednoduchost první) - stužka + pečeť
  // + zlatý pruh nad boxem už samy o sobě dělají vzhled na první pohled jiný.

  // Rámeček + rohové značky.
  const frameX = MARGIN, frameY = MARGIN;
  const frameW = PAGE_W - 2 * MARGIN, frameH = PAGE_H - 2 * MARGIN;
  page.drawRectangle({
    x: frameX, y: frameY, width: frameW, height: frameH,
    borderColor: COL.frame, borderWidth: 1,
  });
  if (vzhled === 'slavnostni') {
    // Vnější linka výrazně jasnější (accLight, silnější) + vnitřní tenčí -
    // dvojitý rám, který je i z dálky vidět, ne jen jemný detail.
    page.drawRectangle({
      x: frameX, y: frameY, width: frameW, height: frameH,
      borderColor: COL.accLight, borderWidth: 1.6,
    });
    const inset = 7;
    page.drawRectangle({
      x: frameX + inset, y: frameY + inset,
      width: frameW - 2 * inset, height: frameH - 2 * inset,
      borderColor: COL.acc, borderWidth: 0.8,
    });
    // Plná zlatá stužka na levém okraji, v prázdném pruhu mezi rámem a
    // obsahem (PAD = 32pt), takže nemůže kolidovat se žádným textem.
    const ribbonTop = frameY + frameH - 50;
    const ribbonBottom = frameY + 50;
    page.drawRectangle({
      x: frameX + 13, y: ribbonBottom, width: 3, height: ribbonTop - ribbonBottom,
      color: COL.acc,
    });
    page.drawRectangle({
      x: frameX + 18, y: ribbonBottom, width: 1, height: ribbonTop - ribbonBottom,
      color: COL.accLight,
    });
  }
  drawCorner(page, frameX, frameY + frameH, CORNER, 'tl', COL.acc);
  drawCorner(page, frameX + frameW, frameY, CORNER, 'br', COL.acc);
  if (vzhled === 'slavnostni') {
    drawCorner(page, frameX + frameW, frameY + frameH, CORNER, 'tr', COL.acc);
    drawCorner(page, frameX, frameY, CORNER, 'bl', COL.acc);
  }

  const contentX = frameX + PAD;
  const contentRight = frameX + frameW - PAD;
  const contentW = contentRight - contentX;
  let y = frameY + frameH - PAD;

  // Kolik řádků bude mít „what" text, se pozná až po zalomení. Spočítá se
  // PŘED kreslením, aby se podle toho dal doladit odstup nahoře. Krátký text
  // (typický případ: naše 4 varianty jsou jednořádkové) by jinak nechal
  // velkou prázdnou plochu mezi textem a pásem dole; s dlouhým textem se
  // extra mezera automaticky vytratí, protože missingLines klesne k nule.
  const whatTrimmed = input.whatText.trim();
  const whatWasHardCut = whatTrimmed.length > LIMITS.whatTextMaxChars;
  const whatRawPreview = whatTrimmed.slice(0, LIMITS.whatTextMaxChars);
  const whatLines = wrapAndClamp(regular, whatRawPreview, 11, contentW, LIMITS.whatTextMaxLines, whatWasHardCut);
  const missingLines = LIMITS.whatTextMaxLines - whatLines.length;
  const extraTopGap = Math.min(90, missingLines * 11);

  // --- Hlavička: wordmark vlevo, kontakt vpravo -----------------------------
  const wordmark = letterSpaced('MARTIN BARNA', ' ');
  page.drawText(wordmark, { x: contentX, y: y - 10, size: 11, font: bold, color: COL.acc });
  const siteLine1 = 'ONLINE VÝŽIVA A FITNESS';
  const siteLine2 = 'MARTINBARNA.CZ';
  page.drawText(siteLine1, {
    x: contentRight - semibold.widthOfTextAtSize(siteLine1, 8), y: y - 4, size: 8, font: semibold, color: COL.muted,
  });
  page.drawText(siteLine2, {
    x: contentRight - semibold.widthOfTextAtSize(siteLine2, 8), y: y - 15, size: 8, font: semibold, color: COL.muted,
  });

  // Pečeť s monogramem MB - jen `slavnostni`, posazená do STRUKTURÁLNĚ VŽDY
  // prázdného pruhu mezi hlavičkou a kickerem (viz komentář u `extraTopGap`
  // výš): i v nejhorším případě (5řádkový what-text, extraTopGap=0) je tu
  // aspoň ~24pt volného místa, pečeť (poloměr 11) se do něj vejde vždycky,
  // bez ohledu na délku jména/textu (ty se kreslí až NÍŽ).
  if (vzhled === 'slavnostni') {
    const sealCx = contentRight - 14;
    const sealCy = y - 36;
    const sealR = 11;
    page.drawEllipse({
      x: sealCx, y: sealCy, xScale: sealR, yScale: sealR,
      color: COL.bg, borderColor: COL.acc, borderWidth: 1.3,
    });
    page.drawEllipse({
      x: sealCx, y: sealCy, xScale: sealR - 3, yScale: sealR - 3,
      borderColor: COL.accLight, borderWidth: 0.5,
    });
    const monogram = 'MB';
    const monoSize = 8;
    page.drawText(monogram, {
      x: sealCx - bold.widthOfTextAtSize(monogram, monoSize) / 2,
      y: sealCy - monoSize / 2 + 1,
      size: monoSize, font: bold, color: COL.acc,
    });
  }

  // --- Střed: kicker / titulek / linka --------------------------------------
  y -= 56 + extraTopGap;
  const kicker = letterSpaced('DÁRKOVÝ POUKAZ', ' ');
  page.drawText(kicker, { x: contentX, y, size: 9, font: bold, color: COL.acc });

  y -= 34;
  page.drawText('Martin Barna', { x: contentX, y, size: 28, font: extrabold, color: COL.white });

  y -= 16;
  page.drawLine({
    start: { x: contentX, y }, end: { x: contentX + 100, y },
    thickness: 2, color: COL.acc,
  });

  // --- Pro / jméno obdarovaného ----------------------------------------------
  y -= 26;
  page.drawText('PRO', { x: contentX, y, size: 8, font: bold, color: COL.acc });
  y -= 26;
  const nameRaw = input.recipientName.trim().slice(0, LIMITS.recipientNameMaxChars) || 'pro tebe';
  const nameFit = truncateToWidth(bold, nameRaw, 22, contentW);
  page.drawText(nameFit, { x: contentX, y, size: 22, font: bold, color: COL.cream });

  // --- Poukaz platí na / what text --------------------------------------------
  y -= 30;
  page.drawText('POUKAZ PLATÍ NA', { x: contentX, y, size: 8, font: bold, color: COL.acc });
  y -= 16;
  for (const line of whatLines) {
    page.drawText(line, { x: contentX, y, size: 11, font: regular, color: COL.cream });
    y -= 15;
  }

  // --- Pásek se třemi sloupci: kód / platnost / jak uplatnit ------------------
  const bandH = 78;
  // FOOTER_GAP posune pásek výš, ať mezi jeho spodkem a patičkou (podpis)
  // zůstane dýchací mezera (dřív se podpis lepil na box). Mezera patička →
  // spodní okraj rámu se tímhle neřeší, ta byla v pořádku už předtím.
  const bandY = frameY + PAD + FOOTER_GAP;
  const bandTop = bandY + bandH;
  page.drawRectangle({
    x: contentX, y: bandY, width: contentW, height: bandH,
    color: COL.band, borderColor: COL.bandLine, borderWidth: 1,
  });
  if (vzhled === 'slavnostni') {
    // Plný zlatý pruh po celé šířce pásku nahoře - stejný "orámuj to zlatě"
    // motiv jako stužka na okraji, ať je box s kódem na první pohled jiný
    // než u tmavé/světlé, ne jen o odstín tmavší pozadí.
    page.drawRectangle({ x: contentX, y: bandTop - 3, width: contentW, height: 3, color: COL.acc });
  }
  const bandPad = 18;
  const col1X = contentX + bandPad;
  const col2X = contentX + bandPad + 200;
  const col3X = contentX + bandPad + 200 + 150;
  const labelY = bandTop - 18;
  const valueY = labelY - 20;

  page.drawText('KÓD POUKAZU', { x: col1X, y: labelY, size: 7.5, font: bold, color: COL.acc });
  page.drawText(input.code, { x: col1X, y: valueY, size: 15, font: extrabold, color: COL.white });

  page.drawText('PLATNOST DO', { x: col2X, y: labelY, size: 7.5, font: bold, color: COL.acc });
  page.drawText(input.validUntilCzech, { x: col2X, y: valueY, size: 13, font: bold, color: COL.white });

  page.drawText('JAK HO UPLATNIT', { x: col3X, y: labelY, size: 7.5, font: bold, color: COL.acc });
  const useLines = wrapAndClamp(
    regular,
    'Napiš mi s tímto kódem na martin@martinbarna.cz nebo na WhatsApp +420 603 229 831 a domluvíme termín.',
    8.5,
    contentRight - col3X,
    4,
  );
  let uy = labelY - 12;
  for (const line of useLines) {
    page.drawText(line, { x: col3X, y: uy, size: 8.5, font: regular, color: COL.muted });
    uy -= 11;
  }

  // --- Patička: podpis vlevo, meta vpravo -------------------------------------
  const footY = frameY + PAD * 0.4;
  page.drawText('Martin Barna', { x: contentX, y: footY + 10, size: 12, font: extrabold, color: COL.cream });
  page.drawText('Online výživový a fitness kouč, v oboru od roku 2013', {
    x: contentX, y: footY, size: 8, font: regular, color: COL.muted,
  });
  // "Vystaveno" tady dřív bylo, ale platnost (PLATNOST DO) je už vidět
  // v pásku výš, takže datum vystavení v patičce bylo navíc (Martinovo
  // zadání 25. 8. 2026: nahradit "Vystaveno" za "Platí do", a protože
  // "Platí do" už na poukazu je, řádek se prostě odstraňuje).
  const metaLine1 = 'martinbarna.cz';
  page.drawText(metaLine1, {
    x: contentRight - regular.widthOfTextAtSize(metaLine1, 8), y: footY + 10, size: 8, font: regular, color: COL.muted,
  });

  return pdfDoc.save();
}

function drawCorner(
  page: import('https://esm.sh/pdf-lib@1.17.1').PDFPage,
  x: number,
  y: number,
  size: number,
  which: 'tl' | 'br' | 'tr' | 'bl',
  acc: RGB,
) {
  const thick = 2;
  if (which === 'tl') {
    page.drawLine({ start: { x, y }, end: { x: x + size, y }, thickness: thick, color: acc });
    page.drawLine({ start: { x, y }, end: { x, y: y - size }, thickness: thick, color: acc });
  } else if (which === 'br') {
    page.drawLine({ start: { x, y }, end: { x: x - size, y }, thickness: thick, color: acc });
    page.drawLine({ start: { x, y }, end: { x, y: y + size }, thickness: thick, color: acc });
  } else if (which === 'tr') {
    page.drawLine({ start: { x, y }, end: { x: x - size, y }, thickness: thick, color: acc });
    page.drawLine({ start: { x, y }, end: { x, y: y - size }, thickness: thick, color: acc });
  } else {
    page.drawLine({ start: { x, y }, end: { x: x + size, y }, thickness: thick, color: acc });
    page.drawLine({ start: { x, y }, end: { x, y: y + size }, thickness: thick, color: acc });
  }
}
