// Sestavení rozloučení po ukončení koučinku.
// Potvrzení (client_operational) a prodejní blok (marketing) jsou oddělené,
// ať send-policy umí prodej po hard unsub vynechat a potvrzení nechat.

export type OffboardMailInput = {
  osloveni: string;
  zena: boolean;
  includeSales: boolean;
};

export function offboardSubject(): string {
  return "Díky za spolupráci. Co dál s appkou a s tvými daty";
}

function escd(s: string): string {
  return String(s).replace(/[<>&"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string),
  );
}

export function buildOffboardInner(input: OffboardMailInput): string {
  const ahoj = input.osloveni ? "Ahoj " + escd(input.osloveni) + "," : "Ahoj,";
  const p = (t: string) => `<p style='margin:0 0 14px'>${t}</p>`;
  const btn = (href: string, label: string) =>
    `<p style='margin:4px 0 18px'><a href='${href}' style='display:inline-block;background:#EBB12C;color:#1A1222;text-decoration:none;padding:13px 26px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:15px'>${label}</a></p>`;
  const btn2 = (href: string, label: string) =>
    `<p style='margin:4px 0 18px'><a href='${href}' style='display:inline-block;border:1px solid #EBB12C;color:#EBB12C;text-decoration:none;padding:12px 25px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:15px'>${label}</a></p>`;
  const rd = (muzsky: string, zensky: string) => (input.zena ? zensky : muzsky);

  const confirm =
    p(ahoj) +
    p("naše spolupráce v koučinku právě končí. Děkuju ti za ni a za práci, kterou jsi do toho " + rd("dal", "dala") + ". Chci, abys " + rd("věděl", "věděla") + ", co se teď děje s tvým přístupem, ať tě nic nepřekvapí.") +
    `<p style='margin:0 0 8px'><strong>Co se změnilo:</strong></p><ul style='margin:0 0 14px;padding-left:20px'>` +
    `<li style='margin:0 0 7px'>Klientská sekce na webu se zavřela.</li>` +
    `<li style='margin:0 0 7px'>S ní skončil i tvůj přístup do appky <strong>Tvůj Coach</strong>, protože jsi ji ${rd("měl", "měla")} v ceně koučinku.</li>` +
    `<li style='margin:0 0 7px'>Účet ani zapsaná data ti nemažu. Zůstávají tam, kdyby ses ${rd("vrátil", "vrátila")}.</li></ul>`;

  const sales =
    p("Jestli sis na appku " + rd("zvykl", "zvykla") + ", můžeš v ní pokračovat i bez koučinku. Je to stejná appka, jen si ji platíš " + rd("sám", "sama") + ":") +
    btn("https://martinbarna.cz/tvuj-coach/?utm_source=mail&utm_medium=offboard&utm_campaign=koucink-konec", "Pokračovat v Tvůj Coach") +
    p("A jestli chceš rozumět tomu, co jsme spolu dělali, a umět si to řídit " + rd("sám", "sama") + ", je tu <strong>Barna Academy</strong>. Je to celý systém výživy a tréninku vysvětlený od základů. Jako " + rd("můj klient", "moje klientka") + " na ni máš <strong>slevu 20 % s kódem KLIENT20</strong> a ten ti platí dál.") +
    btn2("https://martinbarna.cz/akademie/?utm_source=mail&utm_medium=offboard&utm_campaign=koucink-konec", "Mrknout na Academy");

  const closing =
    p("Kdybys " + rd("chtěl", "chtěla") + " někdy koučink znovu, ozvi se. Vím, kde jsme skončili.") +
    p("<strong>Be Effective!</strong><br>Martin");

  return confirm + (input.includeSales ? sales : "") + closing;
}

export function wrapOffboardHtml(inner: string): string {
  return `<!doctype html><html lang='cs'><head><meta charset='utf-8'><meta name='color-scheme' content='dark'></head><body style='margin:0;padding:0;background:#0C0B10'>` +
    `<table role='presentation' width='100%' cellpadding='0' cellspacing='0' border='0' bgcolor='#0C0B10'><tr><td align='center' style='padding:16px'>` +
    `<table role='presentation' width='560' cellpadding='0' cellspacing='0' border='0' bgcolor='#181520' style='width:100%;max-width:560px;background:#181520;border-radius:2px;border:1px solid #262232'><tr><td style='padding:28px;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:16px;line-height:1.55;color:#F0EADF'>` +
    `<div style='border-left:3px solid #EBB12C;padding-left:10px;font-weight:800;font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#EBB12C;margin:0 0 20px'>Martin Barna</div>` +
    inner +
    `<hr style='border:none;border-top:1px solid #262232;margin:22px 0 14px'><div style='font-size:12px;color:#8F8A99'>Martin Barna · martinbarna.cz · osobní mail pro klienty koučinku</div>` +
    `</td></tr></table></td></tr></table></body></html>`;
}

export function buildOffboardMail(input: OffboardMailInput): { subject: string; html: string } {
  return { subject: offboardSubject(), html: wrapOffboardHtml(buildOffboardInner(input)) };
}
