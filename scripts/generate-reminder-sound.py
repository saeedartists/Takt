"""Generate assets/sounds/takt_reminder.wav: Takt's dose-reminder alarm.

Synthesised (no third-party audio, no licensing questions): a rising three-note
bell chime (E5, G#5, B5), repeated with a short pause and slowly growing louder so
it is noticeable without being harsh. About 25 s, under the 30 s iOS limit.
Re-run after changing any constant: python3 scripts/generate-reminder-sound.py
"""
import math
import struct
import wave

RATE = 44100
NOTES = [659.25, 830.61, 987.77]  # E5, G#5, B5 — a bright major triad
NOTE_LEN = 0.42                   # seconds per note, overlapping decay
GAP = 0.9                         # silence between chimes
REPEATS = 8
OUT = 'assets/sounds/takt_reminder.wav'


def bell(freq: float, t: float) -> float:
    # Fundamental plus two soft overtones with an exponential decay: a clear bell, not a beep.
    env = math.exp(-3.2 * t) * min(1.0, t / 0.005)
    return env * (
        math.sin(2 * math.pi * freq * t)
        + 0.35 * math.sin(2 * math.pi * freq * 2.0 * t)
        + 0.12 * math.sin(2 * math.pi * freq * 3.01 * t)
    )


chime_len = NOTE_LEN * (len(NOTES) - 1) + 1.4
period = chime_len + GAP
total = int(RATE * (period * REPEATS))
samples = [0.0] * total
for r in range(REPEATS):
    gain = 0.55 + 0.45 * (r / (REPEATS - 1))  # 55% → 100%
    start = r * period
    for i, freq in enumerate(NOTES):
        onset = int(RATE * (start + i * NOTE_LEN))
        for n in range(int(RATE * 1.4)):
            idx = onset + n
            if idx >= total:
                break
            samples[idx] += gain * bell(freq, n / RATE)

peak = max(abs(s) for s in samples) or 1.0
scale = 0.89 * 32767 / peak
with wave.open(OUT, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes(b''.join(struct.pack('<h', int(s * scale)) for s in samples))
print(f'{OUT}: {total / RATE:.1f} s')
