"""Procedurálně syntetizovaný podkres (vlastní tvorba, žádná licence třetích stran).
Použití: python3 music.py <delka_s> <preset> <vystup.wav>
"""
import sys, wave
import numpy as np

SR = 44100
NOTE = {'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11}

def hz(name, octave):
    return 440.0 * 2 ** ((NOTE[name] + 12 * (octave + 1) - 69) / 12)

def chord(root, minor):
    r = NOTE[root]
    third = 3 if minor else 4
    return [r, r + third, r + 7]

PRESETS = {
    # tempo, akordy (root, moll?)
    'vip':     (120, [('A',1),('F',0),('C',0),('G',0)]),
    'basic':   (120, [('D',1),('Bb',0),('F',0),('C',0)]),
    'vk':      (120, [('C',0),('G',0),('A',1),('F',0)]),
    'academy': (120, [('E',1),('C',0),('G',0),('D',0)]),
    'koucing': (120, [('G',1),('Eb',0),('Bb',0),('F',0)]),
}

def env_adsr(n, a, d, s, r):
    e = np.ones(n) * s
    A, D, R = int(a*SR), int(d*SR), int(r*SR)
    A = max(A,1)
    e[:A] = np.linspace(0, 1, A)
    if D: e[A:A+D] = np.linspace(1, s, len(e[A:A+D]))
    if R: e[-R:] *= np.linspace(1, 0, R)
    return e

def tone(f, dur, harm=(1, .35, .12, .05), detune=0.0):
    t = np.arange(int(dur*SR)) / SR
    out = np.zeros_like(t)
    for i, a in enumerate(harm, start=1):
        out += a * np.sin(2*np.pi*f*i*t)
        if detune:
            out += a * np.sin(2*np.pi*f*i*(1+detune)*t)
    return out

def add(buf, sig, start):
    s = int(start*SR)
    if s >= len(buf): return
    e = min(len(buf), s+len(sig))
    buf[s:e] += sig[:e-s]

def lowpass_fft(x, cutoff):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1/SR)
    X *= 1 / (1 + (f/cutoff)**4)
    return np.fft.irfft(X, len(x))

def highpass_fft(x, cutoff):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1/SR)
    X *= 1 - 1 / (1 + (f/cutoff)**4)
    return np.fft.irfft(X, len(x))

def render(length, preset):
    bpm, prog = PRESETS[preset]
    beat = 60 / bpm
    bar = beat * 4
    n = int(length*SR)
    pad = np.zeros(n); bass = np.zeros(n); arp = np.zeros(n)
    kick = np.zeros(n); hat = np.zeros(n); clap = np.zeros(n)
    rng = np.random.default_rng(7)

    # kick: sinus sweep
    kd = 0.35; kt = np.arange(int(kd*SR))/SR
    kf = 45 + 75*np.exp(-kt*28)
    ksig = np.sin(2*np.pi*np.cumsum(kf)/SR) * np.exp(-kt*9)
    ksig[-int(0.03*SR):] *= np.linspace(1, 0, int(0.03*SR))
    # hat: krátký šum
    hd = 0.06; hsig = highpass_fft(rng.standard_normal(int(hd*SR)), 7000) * np.exp(-np.arange(int(hd*SR))/SR*70)
    # clap: šum v pásmu
    cd = 0.18; craw = rng.standard_normal(int(cd*SR))
    csig = lowpass_fft(highpass_fft(craw, 900), 3500) * np.exp(-np.arange(int(cd*SR))/SR*22)

    nbars = int(np.ceil(length / bar)) + 1
    for b in range(nbars):
        root, minor = prog[b % len(prog)]
        notes = chord(root, minor)
        t0 = b * bar
        # pad
        for k, semi in enumerate(notes):
            f = 440 * 2 ** ((semi + 48 + 12 - 69) / 12)  # oktáva 3-4
            sig = tone(f, bar + 0.4, harm=(1, .5, .25, .12, .06), detune=0.004) * env_adsr(int((bar+0.4)*SR), .5, .3, .8, .5)
            add(pad, sig * 0.10, t0)
        # bas: osminy s pauzami
        fb = 440 * 2 ** ((notes[0] + 36 - 69) / 12)
        for i, on in enumerate([1,0,1,1,0,1,1,0]):
            if on:
                d = beat/2 * 0.9
                sig = tone(fb, d, harm=(1, .3, .08)) * env_adsr(int(d*SR), .005, .15, .5, .05)
                add(bass, sig * 0.30, t0 + i*beat/2)
        # arpeggio šestnáctiny (jen od 2. taktu)
        if b >= 1:
            pattern = [0,1,2,1, 2,0,1,2, 0,2,1,0, 1,2,0,2]
            for i, p in enumerate(pattern):
                semi = notes[p] + 60 + (12 if i % 8 == 7 else 0)
                f = 440 * 2 ** ((semi - 69) / 12)
                d = beat/4
                sig = tone(f, d*1.6, harm=(1, .2, .05)) * env_adsr(int(d*1.6*SR), .003, .12, .0, .02)
                add(arp, sig * 0.07, t0 + i*beat/4)
        # bicí
        for i in range(4):
            add(kick, ksig * 0.55, t0 + i*beat)
            add(hat, hsig * 0.06, t0 + i*beat + beat/2)
            if i in (1, 3):
                add(clap, csig * 0.16, t0 + i*beat)

    pad = lowpass_fft(pad, 1800)
    arp = lowpass_fft(arp, 3200)
    # první takt jen pad + hat (nástup), pak vše
    intro = int(bar*SR*0.5)
    ramp = np.ones(n); ramp[:intro] = np.linspace(0.35, 1, intro)
    mix = pad + hat + arp + (kick + clap + bass) * ramp
    # fade in/out
    fi, fo = int(0.25*SR), int(1.2*SR)
    mix[:fi] *= np.linspace(0, 1, fi)
    mix[-fo:] *= np.linspace(1, 0, fo)
    mix = np.tanh(mix * 1.3) / np.tanh(1.3)
    mix /= max(1e-9, np.max(np.abs(mix))) / 0.89
    return mix

def write(path, x):
    st = np.stack([x, x], axis=1)
    data = (st * 32767).astype('<i2').tobytes()
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data)

if __name__ == '__main__':
    length, preset, out = float(sys.argv[1]), sys.argv[2], sys.argv[3]
    write(out, render(length, preset))
