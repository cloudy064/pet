"""Publish existing metadata without changing artwork or timing."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent / 'assets'
NAMES = {'idle': 'idle', 'blink': 'blink-clean', 'wave': 'wave-smooth',
         'wink': 'wink', 'talk': 'talk', 'pet': 'pet', 'jump': 'jump', 'curious': 'curious'}

def publish():
    registry = {key: json.loads((ROOT / f'pipi-{name}.json').read_text(encoding='utf-8'))
                for key, name in NAMES.items()}
    (ROOT / 'pipi-assets.js').write_text('window.PIPI_ASSETS = ' +
        json.dumps(registry, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    return registry

if __name__ == '__main__':
    print({k: m['frameCount'] for k, m in publish().items()})
