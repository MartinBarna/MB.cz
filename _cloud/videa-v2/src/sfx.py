"""Jemné UI zvuky (ťuknutí, psaní, bublina, výběr) syntetizované kódem z časů událostí.
Použití: python3 sfx.py events.json delka_s vystup.wav"""
import sys, json, wave
import numpy as np
SR = 48000
rng = np.random.default_rng(3)
def env(n, a, d):
    t = np.arange(n) / SR; e = np.exp(-t / d); A = max(1, int(a * SR)); e[:A] *= np.linspace(0, 1, A); return e
def bandnoise(n, lo, hi):
    X = np.fft.rfft(rng.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR); X[(f < lo) | (f > hi)] = 0; x = np.fft.irfft(X, n); return x / (np.abs(x).max() + 1e-9)
def tone(n, f0, f1):
    f = np.linspace(f0, f1, n); return np.sin(2 * np.pi * np.cumsum(f) / SR)
def snd(kind):
    if kind == 'key':   n = int(.035 * SR); return .16 * bandnoise(n, 1800, 5200) * env(n, .001, .007) + .05 * tone(n, 300, 220) * env(n, .001, .01)
    if kind == 'tap':   n = int(.09 * SR);  return .30 * tone(n, 1150, 650) * env(n, .002, .022) + .10 * bandnoise(n, 2000, 7000) * env(n, .001, .004)
    if kind == 'pop':   n = int(.12 * SR);  return .22 * tone(n, 420, 980) * env(n, .004, .035)
    if kind == 'tick':  n = int(.05 * SR);  return .10 * tone(n, 1500, 1350) * env(n, .001, .012)
    if kind == 'shutter': n = int(.16 * SR); return .20 * bandnoise(n, 800, 6000) * (env(n, .001, .02) + .7 * np.roll(env(n, .001, .025), int(.06 * SR)))
    return np.zeros(1)
def main():
    evs = json.load(open(sys.argv[1])); dur = float(sys.argv[2]); out = sys.argv[3]
    mix = np.zeros(int(dur * SR) + SR)
    for e in evs:
        s = snd(e['type']) * (0.85 + 0.3 * rng.random()); i = int(e['t'] * SR)
        if 0 <= i < len(mix): j = min(len(mix), i + len(s)); mix[i:j] += s[:j - i]
    mix = mix[:int(dur * SR)]
    pk = np.abs(mix).max()
    if pk > 0: mix *= 0.5 / pk   # špička −6 dBFS, zvuky zůstávají tiché a jemné
    st = (np.stack([mix, mix], 1) * 32767).astype('<i2')
    with wave.open(out, 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())
main()
