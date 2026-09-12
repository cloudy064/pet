import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT/'scripts/optimize-animation-assets.py'
spec = importlib.util.spec_from_file_location('optimizer', SCRIPT)
optimizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(optimizer)


class GlobalOptimizerTests(unittest.TestCase):
    def fixture(self, root):
        directories = []
        for name, offsets in [('one',[6,9,6]),('two',[9,6,9])]:
            directory = root/name
            directory.mkdir()
            sheet = Image.new('RGBA',(72,24))
            for frame, x in enumerate(offsets):
                im = Image.new('RGBA',(24,24))
                im.paste((30,150,60,255),(x,6,x+5,11))
                sheet.paste(im,(frame*24,0))
            sheet.save(directory/'source.png')
            data = (directory/'source.png').read_bytes()
            a = dict(pages=[dict(file='source.png',width=72,height=24,bytes=len(data),md5=hashlib.md5(data).hexdigest())],
                     tiles=[[0,i*24,0,24,24] for i in range(3)],frameMap=[0,1,2],durations=[70,35,120],
                     anchor=dict(x=12,y=22),crop=dict(x=0,y=0,w=24,h=24),subjectHeight=20,restFrames=[0,2])
            (directory/'manifest.json').write_text(json.dumps(dict(version=1,assets={name:a})))
            directories.append(directory)
        return directories

    def test_global_reuse_preserves_distinct_placement_and_timing(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            inputs = self.fixture(root)
            records, assets, actions, before = optimizer.extract(optimizer.load_sources(inputs))
            optimizer.cluster(records,'exact')
            textures,palette,_ = optimizer.quantize_global(records,'exact')
            output = root/'output'; output.mkdir()
            locations,pages,owners = optimizer.pack(records,output,256,textures,palette)
            manifest = optimizer.build_manifest(assets,records,actions,locations,pages)
            result = optimizer.verify(manifest,records,assets,output,'exact',textures)
            self.assertEqual(before['physicalTiles'],6)
            self.assertEqual(len(locations),1)
            self.assertTrue(all(set(v)=={'one','two'} for v in owners.values()))
            self.assertNotEqual(manifest['assets']['one']['tileRects'][0],manifest['assets']['one']['tileRects'][1])
            self.assertEqual(result['logicalFramesChecked'],6)
            self.assertEqual(manifest['assets']['two']['durations'],[70,35,120])

    def test_failed_build_does_not_replace_previous_verified_output(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            inputs=self.fixture(root)
            output=root/'output'
            command=[sys.executable,str(SCRIPT),'--profile','exact','--output',str(output)]
            for directory in inputs: command += ['--input',str(directory)]
            subprocess.run(command,check=True,stdout=subprocess.DEVNULL)
            before=(output/'manifest.json').read_bytes()
            manifest=json.loads(before)
            self.assertEqual(manifest['layout'],'single')
            self.assertEqual(len({p['file'] for a in manifest['assets'].values() for p in a['pages']}),1)
            subprocess.run(command,check=True,stdout=subprocess.DEVNULL)
            self.assertEqual((output/'manifest.json').read_bytes(),before)
            (inputs[0]/'source.png').write_bytes(b'corrupt image')
            result=subprocess.run(command,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
            self.assertNotEqual(result.returncode,0)
            self.assertEqual((output/'manifest.json').read_bytes(),before)

    def test_protected_pose_is_not_replaced_even_when_a_near_neighbour_exists(self):
        with tempfile.TemporaryDirectory() as temp:
            inputs=self.fixture(Path(temp))
            records,_,_,_=optimizer.extract(optimizer.load_sources(inputs))
            optimizer.cluster(records,'compact')
            for record in records:
                if record['protected']:
                    self.assertEqual(record['representative'],record['id'])


if __name__=='__main__':
    unittest.main()
