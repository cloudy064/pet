"""Verify the delivered files, not just the manifest shape. No source editing."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT/'assets/companion'


def main():
    manifest=json.loads((BASE/'manifest.json').read_text())
    audit=json.loads((BASE/'build.json').read_text())
    sources={entry['id']:entry for entry in json.loads((BASE/'source/generation.json').read_text())['entries']}
    assert len(manifest['actions']) == 16
    total_frames=0; total_bytes=0; maximum=0; actions=[]
    for action,record in zip(manifest['actions'],audit['actions']):
        assert action['id']==record['id']
        name=action['id'];asset=manifest['assets'][action['asset']]
        source=sources[name]
        assert hashlib.sha256((BASE/'source'/source['file']).read_bytes()).hexdigest()==source['sha256']==record['sourceSHA256']
        assert hashlib.sha256((BASE/'masters'/f'{name}.png').read_bytes()).hexdigest()==record['masterSHA256']
        assert action['allowSpeech'] is False
        images=[]
        for page,expected in zip(asset['pages'],record['pages']):
            path=BASE/page['file'];data=path.read_bytes()
            assert hashlib.md5(data).hexdigest()==page['md5'],name+' MD5'
            assert hashlib.sha256(data).hexdigest()==expected['sha256'],name+' SHA256'
            assert len(data)==page['bytes']
            image=Image.open(path)
            assert image.mode=='RGBA' and image.size==(page['width'],page['height'])
            assert max(image.size)<=2048
            images.append(image);total_bytes+=len(data)
        maximum=max(maximum,record['decodedBytes'])
        frames=[]
        for p,x,y,w,h in asset['tiles']:
            tile=np.array(images[p].crop((x,y,x+w,y+h)))
            alpha=tile[:,:,3]
            assert np.count_nonzero(alpha>128)>3000,name+' empty frame'
            assert np.count_nonzero(alpha==0)>alpha.size*.15,name+' opaque background'
            assert not any(np.any(edge) for edge in [alpha[0],alpha[-1],alpha[:,0],alpha[:,-1]]),name+' clipped edge'
            chroma=np.minimum(tile[:,:,0].astype(float),tile[:,:,2])-tile[:,:,1]
            # Saturated key magenta, excluding occasional blue-edge Lanczos
            # overshoot (the character legitimately has blue wing feathers).
            assert np.count_nonzero((chroma>100)&(alpha>64))==0,name+' magenta residue'
            frames.append(tile)
        assert np.array_equal(frames[0],frames[-1]),name+' idle endpoints differ'
        assert len(asset['durations'])==len(asset['frameMap'])
        assert all(t>0 for t in asset['durations'])
        for overlay_id in action.get('overlays', []):
            overlay=manifest['assets'][overlay_id]
            assert overlay['frameMap']==asset['frameMap'] and overlay['durations']==asset['durations']
            visible_pixels=0
            for page in overlay['pages']:
                path=BASE/page['file'];data=path.read_bytes()
                expected=next(p for p in record['pages'] if p['file']==page['file'])
                assert hashlib.md5(data).hexdigest()==page['md5']
                assert hashlib.sha256(data).hexdigest()==expected['sha256']
                image=Image.open(path)
                assert image.mode=='RGBA' and image.size==(page['width'],page['height'])
                assert max(image.size)<=2048
                visible_pixels+=np.count_nonzero(np.array(image)[:,:,3])
                total_bytes+=len(data)
            assert visible_pixels>50,name+' empty prop track'
        if action['type']=='staged':
            for indices in action['stages'].values():
                assert indices and all(0<=i<len(frames) for i in indices)
            assert action['stages']['open'][0]==0
            assert action['stages']['close'][-1]==len(frames)-1
        total_frames+=len(asset['frameMap'])
        actions.append({'id':name,'frames':len(asset['frameMap']),'pages':len(images),'alphaAndBounds':True,'idleEndpointsMatch':True})
    catalog=json.loads((BASE/'audio/catalog.json').read_text())
    for track in catalog['tracks']:
        data=(BASE/track['audioURL']).read_bytes()
        assert hashlib.sha256(data).hexdigest()==track['sha256']
        assert len(data)==track['bytes'] and track['durationMs']>1000
    report={'result':'PASS','frames':total_frames,'runtimePNGBytes':total_bytes,'maxActionDecodedBytes':maximum,'audioTracks':len(catalog['tracks']),'actions':actions}
    (BASE/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='actions'},indent=2))

if __name__=='__main__':main()
