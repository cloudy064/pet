"""Verify the default WebP demo and retained single-atlas variants in Chromium."""
from pathlib import Path
import argparse
import json
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--assets', choices=['default','png','tinyimg'], default='default')
args = parser.parse_args()
OUT = ROOT / 'test-results/sdk-demo' / args.assets
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':1100,'height':1000})
    page = context.new_page()
    errors, images = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda r: images.append(r.url) if not r.url.startswith('blob:') and (r.resource_type == 'image' or '/atlas-' in r.url) else None)
    page.goto('http://127.0.0.1:8765/examples/sdk-demo/' + ('' if args.assets == 'default' else '?assets=' + args.assets))
    page.wait_for_function('window.pipiDemo?.pet.status === "ready"', timeout=120000)
    paged = args.assets == 'default'
    assert len(images) == (2 if paged else 1), images
    assert all('/atlas-' in url for url in images), images
    assert all('.webp' in url for url in images) if paged else True
    initial_images = list(images)
    if not paged: context.set_offline(True)
    checks = []
    for action in ['wave','jump','nod','dance','stretch','kiss']:
        if paged: context.set_offline(False)
        page.locator(f'[data-action="{action}"]').click()
        page.wait_for_function('pipiDemo.pet.current?.status === "playing"')
        if paged: context.set_offline(True)
        # Capture real requestAnimationFrame playback; verify pixels, not only status or frame counters.
        result = page.evaluate('''async()=>{
          const {pet}=pipiDemo, task=pet.current, canvas=pet.adapter.canvas, hashes=new Set(), frames=new Set();
          let minimumPixels=Infinity;
          function sample(){
            if(pet.current!==task)return;
            const a=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
            let h=2166136261,n=0;
            for(let i=0;i<a.length;i+=4){if(a[i+3]>16)n++;for(let c=0;c<4;c++)h=Math.imul(h^a[i+c],16777619);}
            minimumPixels=Math.min(minimumPixels,n);hashes.add(h>>>0);frames.add(pet.snapshot().frame);
          }
          sample();const timer=setInterval(sample,70);
          const result=await task.finished;clearInterval(timer);
          return {status:result.status,distinctRenders:hashes.size,frames:frames.size,minimumPixels};
        }''')
        assert result['status'] == 'finished', (action,result)
        assert result['distinctRenders'] >= 6, (action,result)
        assert result['minimumPixels'] > 1000, (action,result)
        checks.append({'action':action,**result})
    assert all('.webp' in url for url in images) if paged else len(images) == 1, images
    page.locator('#pause').click()
    assert page.evaluate('pipiDemo.pet.paused')
    page.locator('#speed').select_option('1.5')
    assert page.evaluate('pipiDemo.pet.speed') == 1.5
    page.locator('#stop').click()
    assert not page.evaluate('pipiDemo.pet.paused')
    page.screenshot(path=str(OUT/'single-desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(200)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(OUT/'single-mobile.png'),full_page=True)
    assert not errors, errors
    report={'initialImageRequests':initial_images,'imageRequests':images,'offlinePlaybackAfterActionReady':True,'actions':checks,'errors':errors}
    (OUT/'single-atlas-browser.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
    browser.close()
