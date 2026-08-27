// Testy jedineho mista, kde by mohl vzniknout otevreny redirect.
// Spusteni: deno test cil.test.ts
import { assertEquals } from 'jsr:@std/assert@1';
import { bezpecnyCil, NOUZOVY_CIL, urlProLog } from './cil.ts';

const S = (raw: string, duveryhodny = true) => bezpecnyCil(raw, duveryhodny, 'lead-magnet', 'lm-3');

Deno.test('povolene hostitele s platnym podpisem projdou', () => {
  assertEquals(S('https://buy.stripe.com/abc')?.startsWith('https://buy.stripe.com/abc'), true);
  assertEquals(S('https://tvujcoach.cz/client')?.startsWith('https://tvujcoach.cz/client'), true);
});

Deno.test('⛔ cizi domena se odmitne i s platnym podpisem', () => {
  assertEquals(S('https://evil.com/'), null);
  assertEquals(S('https://martinbarna.cz.evil.com/'), null);
  assertEquals(S('https://evil.com/?x=martinbarna.cz'), null);
});

Deno.test('⛔ past s @ v adrese: hostitel je to za zavinacem', () => {
  assertEquals(S('https://martinbarna.cz@evil.com/'), null);
});

Deno.test('⛔ jine schema nez https se odmitne', () => {
  assertEquals(S('http://martinbarna.cz/'), null);
  assertEquals(S('javascript:alert(1)'), null);
  assertEquals(S('data:text/html,<script>x</script>'), null);
  assertEquals(S('mailto:martin@martinbarna.cz'), null);
});

Deno.test('⛔ relativni adresa a //evil.com neprojdou (chybi schema)', () => {
  assertEquals(S('//evil.com/'), null);
  assertEquals(S('/akademie/'), null);
  assertEquals(S(''), null);
});

Deno.test('⛔ bez platneho podpisu se na Stripe nejde, na nas web ano', () => {
  assertEquals(S('https://buy.stripe.com/podvrzeny', false), null);
  assertEquals(S('https://martinbarna.cz/videokurz', false)?.startsWith('https://martinbarna.cz/videokurz'), true);
});

Deno.test('UTM se dolepi jen na nase weby a jen kdyz tam jeste nejsou', () => {
  const nas = S('https://martinbarna.cz/videokurz')!;
  assertEquals(new URL(nas).searchParams.get('utm_campaign'), 'lead-magnet');
  assertEquals(new URL(nas).searchParams.get('utm_content'), 'lm-3');

  const uzMa = S('https://martinbarna.cz/videokurz?utm_source=vlastni&utm_campaign=puvodni')!;
  assertEquals(new URL(uzMa).searchParams.get('utm_source'), 'vlastni');
  assertEquals(new URL(uzMa).searchParams.get('utm_campaign'), 'puvodni');

  const stripe = S('https://buy.stripe.com/abc')!;
  assertEquals(new URL(stripe).searchParams.has('utm_source'), false);
});

Deno.test('nouzovy cil je nas web, ne redirect nikam', () => {
  assertEquals(NOUZOVY_CIL, 'https://martinbarna.cz/');
});

Deno.test('⛔ e-mail se z ukladane URL vyhodi', () => {
  const skryto = urlProLog('https://martinbarna.cz/akademie/prihlaseni/?tab=up&email=nekdo%40example.cz&next=/moje');
  assertEquals(skryto.includes('example.cz'), false);
  assertEquals(skryto.includes('%28skryto%29') || skryto.includes('(skryto)'), true);
  assertEquals(new URL(skryto).searchParams.get('next'), '/moje');
});

Deno.test('adresa, ktera nejde rozparsovat, se ulozi orezana a nespadne', () => {
  assertEquals(urlProLog('rozbite'), 'rozbite');
});
