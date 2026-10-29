// Whitelist klicu, ktere smi prijit z metadata.kosik_klic.
// Videokurz a Academy v teto vlne nejsou. Kazdy klic musi byt i v KATALOG webhooku.

export const KOSIK_KLICE = [
  "konzultace",
  "konzultace-vk",
  "coaching-gold-1",
  "coaching-gold-3",
  "coaching-gold-6",
  "coaching-diamond-1",
  "coaching-diamond-3",
  "coaching-diamond-6",
] as const;

export type KosikKlic = (typeof KOSIK_KLICE)[number];
