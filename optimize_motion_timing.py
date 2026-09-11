"""Idempotent timing pass. Run after artwork packers; PNG pixels are untouched."""
import json
from build_asset_registry import ROOT, NAMES, publish

def read(name):
    return json.loads((ROOT / name).read_text(encoding='utf-8'))

def save(name, value):
    (ROOT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def timing(m, durations, reason):
    assert len(durations) == m['frameCount'] and min(durations) >= 1000 / 60 - .001
    m.setdefault('originalTiming', {'durationMs': m['durationMs'], 'frameDurationsMs': m['frameDurationsMs']})
    m['frameDurationsMs'] = durations
    m['durationMs'] = sum(durations)
    m['timingRevision'] = 1
    m['timingNote'] = reason
    m['timingMode'] = 'per-frame'
    for f, ms in zip(m['frames'], durations):
        f['durationMs'] = ms

profiles = {
    'blink': ([1000/60]*12 + [260/12]*12, 'Close promptly; reopen more softly. All 24 frames retained.'),
    'wave': ([65]+[25]*18+[1000/30]*24+[25]*17+[90], 'Quicker lift and recovery; preserve the slower expressive wave.'),
    'wink': ([70]+[30]*15+[240]+[30]*15+[130], 'Shorten the wink hold; retain a relaxed return.'),
    'talk': ([60]+[50]*9+[150]+[50]*9+[90]+[50]*10+[120], 'Natural beak opening and closing, with a longer phrase break.'),
    'pet': ([80]+[1000/30]*17+[420]+[1000/30]*17+[120], 'Keep the contented hold and soft recovery; remove excess neutral delay.'),
    'jump': ([60]+[30]*8+[25]*27+[30]*12+[100], 'Shorter ballistic flight without an artificial apex hold; allow landing to settle.'),
    'curious': ([80]+[30]*19+[420]+[30]*19+[120], 'Observe briefly, then return gently; shorten the frozen middle.'),
}
for key, (ds, note) in profiles.items():
    name = f'pipi-{NAMES[key]}.json'
    m = read(name)
    timing(m, ds, note)
    save(name, m)
publish()

walk = read('pipi-walk.json')
for key, m in walk['assets'].items():
    turn = 40 if key in ('n', 'nw', 'ne') else 1000/30 if key in ('w', 'e') else 30
    timing(m, [turn]*14 + [30]*32 + [turn]*14 + [80],
           'Even 960 ms gait cycle; rear-facing turns get more time; finish on a settled stance.')
    m['cycleDurationMs'] = sum(m['frameDurationsMs'][14:46])
    save(f'pipi-walk-{key}.json', m)
save('pipi-walk.json', walk)
(ROOT/'pipi-walk-assets.js').write_text('window.PIPI_WALK = '+json.dumps(walk,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')

flight = read('pipi-flight.json')
for key, ds in {'takeoff': [30]*16+[25]*13, 'land': [25]*33+[30]*7+[80]}.items():
    m = flight['assets'][key]
    timing(m, ds, 'Clear anticipation, brisk lift / touchdown, and a soft final settle.')
    save(f'pipi-flight-{key}.json', m)
flight['timing'].update(takeoffMs=flight['assets']['takeoff']['durationMs'],landMs=flight['assets']['land']['durationMs'])
save('pipi-flight.json', flight)
(ROOT/'pipi-flight-assets.js').write_text('window.PIPI_FLIGHT = '+json.dumps(flight,ensure_ascii=False,indent=2)+';\n',encoding='utf-8')
print('Updated per-frame timing: 7 expressions, 8 walks, takeoff and landing.')
