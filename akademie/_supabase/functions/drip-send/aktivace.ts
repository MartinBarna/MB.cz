

export type StavZapisu = 'zapsal' | 'nezapsal' | 'nevime';
export type Podminka = 'jen_kdyz_nezapsal' | 'jen_kdyz_zapsal' | 'jen_kdyz_aktivni';
export type AkceZapisu =
  | { typ: 'posli' }
  | { typ: 'preskoc'; podminka: Podminka }
  | { typ: 'odloz'; podminka: Podminka }
  | { typ: 'pauza'; podminka: Podminka }
  | { typ: 'rescue_pauza'; podminka: Podminka }
  | { typ: 'rescue_krok'; podminka: Podminka; step: number };
export const OKNO_NEAKTIVITY_DNI = 7;
export const ODLOZ_MS = 86400000;
export const CADENCE_CREATED_MAX_DNI = 21;
export const FREE_TC_TRATE: readonly string[] = ['tc-zkusebka', 'tc-free', 'tc-magnet', 'tc-start', 'tc-foods'];
const LONGTAIL_PREFIXY: readonly string[] = ['longtail-', 'evergreen-'];
export const KROK_PODLE_ZAPISU: Record<string, Podminka> = {
  'tc-zkusebka/0': 'jen_kdyz_nezapsal','tc-zkusebka/1': 'jen_kdyz_zapsal','tc-zkusebka/2': 'jen_kdyz_aktivni',
  'tc-free/2': 'jen_kdyz_aktivni','tc-free/3': 'jen_kdyz_aktivni','tc-free/4': 'jen_kdyz_aktivni','tc-free/5': 'jen_kdyz_aktivni','tc-free/6': 'jen_kdyz_aktivni','tc-free/7': 'jen_kdyz_aktivni','tc-free/8': 'jen_kdyz_aktivni','tc-free/9': 'jen_kdyz_aktivni','tc-free/10': 'jen_kdyz_aktivni','tc-free/11': 'jen_kdyz_aktivni','tc-magnet/2': 'jen_kdyz_aktivni','tc-magnet/3': 'jen_kdyz_aktivni','tc-magnet/4': 'jen_kdyz_aktivni','tc-magnet/5': 'jen_kdyz_aktivni','tc-start/1': 'jen_kdyz_aktivni',
};
export const RESCUE_KROK: Record<string, number> = { 'tc-zkusebka': 3 };
export function trateSeSignalem(mapa: Record<string, Podminka> = KROK_PODLE_ZAPISU): Set<string> { const out = new Set<string>(); for (const klic of Object.keys(mapa)) { const i = klic.lastIndexOf('/'); if (i > 0) out.add(klic.slice(0, i)); } return out; }
export function trateProAppSignal(mapa: Record<string, Podminka> = KROK_PODLE_ZAPISU): Set<string> { const out = trateSeSignalem(mapa); if (out.size === 0) return out; for (const t of FREE_TC_TRATE) out.add(t); return out; }
export function klicKroku(track: string, step: number): string { return String(track ?? '') + '/' + step; }
export function nactiAktivniZOdpovedi(telo: unknown): Set<string> | null { if (!telo || typeof telo !== 'object') return null; const t = telo as Record<string, unknown>; if (!Array.isArray(t.zapsali)) return null; const out = new Set<string>(); const pridej = (arr: unknown) => { if (!Array.isArray(arr)) return; for (const e of arr) { const s = String(e ?? '').trim().toLowerCase(); if (s.includes('@')) out.add(s); } }; pridej(t.zapsali); pridej(t.vazili); pridej(t.aktivni); return out; }
export function cadenceOdIso(vars: unknown, createdAt: unknown, tedIso: string): string { const stare = (vars && typeof vars === 'object' && !Array.isArray(vars)) ? vars as Record<string, unknown> : null; const c = stare && stare._cadence && typeof stare._cadence === 'object' && !Array.isArray(stare._cadence) ? stare._cadence as Record<string, unknown> : null; if (c && typeof c.od === 'string' && Number.isFinite(Date.parse(c.od))) return c.od; const created = typeof createdAt === 'string' ? createdAt : (createdAt instanceof Date ? createdAt.toISOString() : ''); if (created && Number.isFinite(Date.parse(created)) && Number.isFinite(Date.parse(tedIso))) { const dni = (Date.parse(tedIso) - Date.parse(created)) / 86400000; if (dni >= 0 && dni <= CADENCE_CREATED_MAX_DNI) return created; } return tedIso; }
export function oknoUplynulo(odIso: string, tedMs: number, oknoDni: number = OKNO_NEAKTIVITY_DNI): boolean { const t = Date.parse(odIso); if (!Number.isFinite(t) || !Number.isFinite(tedMs) || oknoDni < 0) return false; return (tedMs - t) >= oknoDni * 86400000; }
export function varsSCadenceOd(vars: unknown, odIso: string): Record<string, unknown> { const stare = (vars && typeof vars === 'object' && !Array.isArray(vars)) ? { ...(vars as Record<string, unknown>) } : {}; const prev = (stare._cadence && typeof stare._cadence === 'object' && !Array.isArray(stare._cadence)) ? { ...(stare._cadence as Record<string, unknown>) } : {}; if (typeof prev.od === 'string' && Number.isFinite(Date.parse(prev.od))) return stare; stare._cadence = { ...prev, od: odIso }; return stare; }
export function mostBlokujeNeaktivitu(zdrojTrack: string, cilTrack: string, stav: StavZapisu): boolean { if (stav !== 'nezapsal') return false; const z = String(zdrojTrack || ''); const c = String(cilTrack || ''); if (!FREE_TC_TRATE.some((t) => t === z)) return false; return LONGTAIL_PREFIXY.some((p) => c.indexOf(p) === 0); }
export interface RozhodniCtx { oknoUplynulo?: boolean; rescueKrok?: Record<string, number>; }
export function rozhodniPodleZapisu(track: string, step: number, stav: StavZapisu, mapa: Record<string, Podminka> = KROK_PODLE_ZAPISU, ctx: RozhodniCtx = {}): AkceZapisu { const podminka = mapa[klicKroku(track, step)]; if (!podminka) return { typ: 'posli' }; if (stav === 'nevime') return { typ: 'posli' }; if (podminka === 'jen_kdyz_nezapsal') return stav === 'zapsal' ? { typ: 'preskoc', podminka } : { typ: 'posli' }; if (stav === 'zapsal') return { typ: 'posli' }; if (!ctx.oknoUplynulo) return { typ: 'odloz', podminka }; if (podminka === 'jen_kdyz_zapsal') { const rescue = (ctx.rescueKrok ?? RESCUE_KROK)[String(track ?? '')]; if (typeof rescue === 'number' && rescue !== step) return { typ: 'rescue_krok', podminka, step: rescue }; if (typeof rescue === 'number' && rescue === step) return { typ: 'rescue_pauza', podminka }; return { typ: 'pauza', podminka }; } return { typ: 'rescue_pauza', podminka }; }
export function maPreskocitPodleZapisu(track: string, step: number, stav: StavZapisu, mapa: Record<string, Podminka> = KROK_PODLE_ZAPISU, ctx: RozhodniCtx = {}): Podminka | null { const akce = rozhodniPodleZapisu(track, step, stav, mapa, ctx); if (akce.typ === 'posli') return null; return mapa[klicKroku(track, step)] ?? null; }
