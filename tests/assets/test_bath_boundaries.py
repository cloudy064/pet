"""Bath source wings may cross grid lines; extract complete, separate silhouettes."""
import importlib.util
import json
from pathlib import Path
import unittest
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('companion_builder', ROOT/'scripts/build-companion-assets.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

class BathBoundaries(unittest.TestCase):
    def test_runtime_close_frames_have_no_detached_wing_fragments(self):
        roots = [ROOT/'assets/companion']
        if (ROOT/'dist/optimized-webp-frames/manifest.json').exists():
            roots.append(ROOT/'dist/optimized-webp-frames')
        for root in roots:
            asset = json.loads((root/'manifest.json').read_text())['assets']['companion:bath']
            for frame in [19, 20]:
                page, x, y, w, h = asset['tiles'][asset['frameMap'][frame]]
                with Image.open(root/asset['pages'][page]['file']) as image:
                    alpha = np.array(image.convert('RGBA').crop((x, y, x+w, y+h)))[:, :, 3]
                labels, _ = ndi.label(alpha > 32)
                sizes = np.bincount(labels.ravel())[1:]
                self.assertEqual(sum(sizes > 8), 1, (str(root), frame, list(sizes)))

    def test_complete_silhouettes_do_not_include_neighbors(self):
        with Image.open(ROOT/'assets/companion/source/bath-v1.png') as source:
            original = np.array(builder.key_image(source))
            poses = builder.connected_grid_poses(source)
        self.assertEqual(len(poses), 16)
        # Every keyed foreground pixel is assigned once; wings crossing the
        # nominal cell boundary are retained in their own pose rather than cut off.
        self.assertEqual(sum(np.count_nonzero(np.array(p)[:, :, 3]) for p in poses),
                         np.count_nonzero(original[:, :, 3]))
        for pose in poses:
            _, count = ndi.label(np.array(pose)[:, :, 3] > 0)
            self.assertEqual(count, 1)
        self.assertEqual(poses[9].width, 197)
        self.assertEqual(poses[10].width, 271)

if __name__ == '__main__': unittest.main()
