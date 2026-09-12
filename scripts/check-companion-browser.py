"""Exercise public companion UI. Full mode also requires every new transparent runtime atlas."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
import json
import threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results' / 'companion'


class Quiet(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.mjs': 'text/javascript'}
    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--logic-only', action='store_true', help='Do not claim new-image validation')
    parser.add_argument('--optimized', action='store_true', help='Use generated global assets in the real companion UI')
    args = parser.parse_args()
    query = '?assets=optimized' if args.optimized else ''
    OUT.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = f'http://127.0.0.1:{server.server_port}'
    report = {'logic': False, 'newImages': False, 'actions': [], 'audio': [], 'errors': []}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={'width': 1280, 'height': 1000})
            page = context.new_page()
            page.add_init_script('''(()=>{const Native=window.Audio;window.__pipiAudio=[];window.__pipiEnded=[];
              window.Audio=function(...args){const audio=new Native(...args);window.__pipiAudio.push(audio);
                audio.addEventListener('ended',()=>window.__pipiEnded.push(audio.src));return audio;};})();''')
            page.on('pageerror', lambda error: report['errors'].append(str(error)))
            page.goto(origin + '/examples/companion/' + query)
            page.wait_for_function('window.pipiCompanionDemo && pipiCompanionDemo.companion.state')
            # A second real tab cannot mutate the demo account while the first owns it.
            other = page.context.new_page()
            other.goto(origin + '/examples/companion/')
            other.wait_for_function('document.querySelector("#notice").textContent.includes("另一个标签页")')
            assert other.evaluate('window.pipiCompanionDemo === undefined')
            # Native Web Locks protect the compare-and-save across JS realms too.
            for tab in [page, other]:
                tab.evaluate("""() => {
                  window.casResult = PipiCompanion.createWebStore(localStorage, 'cas-browser-test')
                    .save({revision:1}, {expectedRevision:0})
                    .then(()=>'saved', error=>error.code);
                }""")
            results = [tab.evaluate('window.casResult') for tab in [page, other]]
            assert sorted(results) == ['COMPANION_STORAGE_CONFLICT', 'saved']
            other.close()
            report['crossTabStorage'] = True
            page.locator('[data-mode="learning"]').click()
            page.screenshot(path=str(OUT / 'learning.png'), full_page=True)
            # Use the real lesson controls; no direct growth mutation.
            equation = page.locator('#equation').inner_text()
            a, b = [int(v.strip()) for v in equation.split('=')[0].split('+')]
            page.locator('#answers button').filter(has_text=str(a+b)).click()
            page.wait_for_function('pipiCompanionDemo.companion.state.growthPoints === 1')
            assert page.evaluate('pipiCompanionDemo.ledger.balance') == 15
            assert page.evaluate('pipiCompanionDemo.pet.free === null')
            page.reload()
            page.wait_for_function('window.pipiCompanionDemo && pipiCompanionDemo.companion.state?.growthPoints === 1')
            page.locator('#feed').click()
            page.wait_for_function('pipiCompanionDemo.companion.state.satiation > 99')
            assert page.evaluate('pipiCompanionDemo.ledger.balance') == 12
            page.locator('#feed').click()
            page.wait_for_function('document.querySelector("#notice").textContent.includes("吃饱")')
            assert page.evaluate('pipiCompanionDemo.ledger.balance') == 12
            page.locator('#bath').click()
            page.wait_for_function('pipiCompanionDemo.companion.careKind === "bath"')
            page.locator('#leave-bath').click()
            page.locator('#pet').click()
            page.wait_for_function('pipiCompanionDemo.companion.careKind === "pet"')
            assert page.evaluate('pipiCompanionDemo.pet.current?.action !== "bath"')
            page.locator('#leave-bath').click()
            page.locator('#bath').click()
            page.wait_for_function('pipiCompanionDemo.companion.careKind === "bath"')
            assert page.evaluate('pipiCompanionDemo.pet.options.interactionLocked')
            cells = page.evaluate('''()=>{
              const r=document.querySelector('#care-canvas').getBoundingClientRect(),s=pipiCompanionDemo.pet.snapshot();
              return PipiCompanion.BATH_CELLS.map(i=>({x:r.left+s.position.x-s.size*.34+(i%8+.5)/8*s.size*.68,y:r.top+s.position.y-s.size+(Math.floor(i/8)+.5)/12*s.size}));
            }''')
            page.mouse.move(cells[0]['x'], cells[0]['y'])
            page.mouse.down()
            for point in cells:
                page.mouse.move(point['x'], point['y'])
            page.mouse.up()
            page.wait_for_function('pipiCompanionDemo.companion.state.bath.phase === "rinse"')
            page.screenshot(path=str(OUT / 'soap.png'), full_page=True)
            page.locator('#rinse').click()
            page.wait_for_function('pipiCompanionDemo.companion.state.bath === null')
            assert page.evaluate('pipiCompanionDemo.companion.state.cleanliness') == 100
            page.locator('#pet').click()
            page.wait_for_function('pipiCompanionDemo.companion.careKind === "pet"')
            points = page.evaluate('''()=>{const r=document.querySelector('#care-canvas').getBoundingClientRect(),s=pipiCompanionDemo.pet.snapshot();return [.2,.8,.2,.8].map(x=>({x:r.left+s.position.x-s.size*.34+x*s.size*.68,y:r.top+s.position.y-s.size*.5}));}''')
            page.mouse.move(points[0]['x'], points[0]['y']); page.mouse.down()
            for point in points:
                page.mouse.move(point['x'], point['y'])
            page.mouse.up()
            page.wait_for_function('pipiCompanionDemo.pet.current?.action === "pet"')
            page.locator('#leave-bath').click()
            page.locator('[data-mode="rest"]').click()
            assert page.evaluate('pipiCompanionDemo.companion.mode') == 'rest'
            page.locator('#wake').click()
            page.set_viewport_size({'width': 390, 'height': 844})
            page.wait_for_timeout(150)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=str(OUT / 'mobile.png'), full_page=True)
            report['logic'] = True
            if not args.logic_only:
                # Click the actual song controls and observe native media time,
                # natural ending, and cancellation when leaving home.
                page.locator('#song-zh').click()
                page.wait_for_function('__pipiAudio.some(a=>!a.paused && a.currentTime>.1)')
                page.wait_for_function('__pipiEnded.some(url=>url.includes("count-zh"))', timeout=25000)
                page.wait_for_function('pipiCompanionDemo.pet.speech===null')
                report['audio'].append({'id':'count-zh','nativePlayback':True,'naturalEnd':True})
                page.locator('#song-en').click()
                page.wait_for_function('__pipiAudio.some(a=>a.src.includes("count-en") && !a.paused && a.currentTime>.1)')
                page.locator('[data-mode="learning"]').click()
                page.wait_for_function('pipiCompanionDemo.pet.speech===null && __pipiAudio.every(a=>a.paused)')
                report['audio'].append({'id':'count-en','nativePlayback':True,'pageCancellation':True})
                page.set_viewport_size({'width': 1280, 'height': 1000})
                page.goto(origin + '/examples/companion/animations.html')
                page.wait_for_function('window.pipiAnimationGallery?.manifest')
                result = page.evaluate('''async()=>{
                  const {pet,manifest}=pipiAnimationGallery;pet.stop();pet.autoTick=false;pet.halt();pet.resume();
                  const checks=[],assert=(ok,message)=>{if(!ok)throw Error(message);};let peakDecodedBytes=0;
                  for(const action of manifest.actions){
                    const original=pet.play(action.id,{sustain:action.type==='staged'});await original.ready;assert(original.status==='playing',action.id+' ready: '+original.status+' '+String((await original.ready).error?.stack||''));
                    if(action.type==='staged'){
                      const plan=original.plan;pet.seek(plan.open.duration+plan.loop.duration/2);original.release();
                      assert(plan.closeAt>=original.elapsed,action.id+' release must finish loop');
                      const cycles=(plan.closeAt-plan.open.duration)/plan.loop.duration;
                      assert(Math.abs(cycles-Math.round(cycles))<1e-8,action.id+' release cycle boundary');
                      pet.seek(plan.closeAt+.01);assert(plan.sample(original.elapsed).phase==='close',action.id+' closing phase');
                      pet.update(original.duration-original.elapsed+1);assert(original.status==='finished',action.id+' natural end');
                    }
                    pet.stop();
                    pet.actions.register({...action,id:'verify-'+action.id,type:action.type==='companionClip'?'companionClip':'clip'});
                    const playback=pet.play('verify-'+action.id);await playback.ready;assert(playback.status==='playing',action.id+' raw frames ready');
                    const asset=pet.assets.get(action.asset),lease=playback.lease.assets.get(action.asset);
                    for(const image of lease.images){const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let transparent=0;for(let i=3;i<data.length;i+=4)if(data[i]===0)transparent++;assert(transparent>data.length/4*.15,action.id+' real transparent background');}
                    const ctx=pet.adapter.canvas.getContext('2d'),hashes=new Set();
                    for(let f=0,elapsed=0;f<asset.durations.length;elapsed+=asset.durations[f++]){
                      pet.seek(elapsed+.01);const pixels=ctx.getImageData(0,0,pet.adapter.canvas.width,pet.adapter.canvas.height).data;let count=0,hash=2166136261;
                      for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]>16)count++;hash=Math.imul(hash^pixels[i],16777619);hash=Math.imul(hash^pixels[i+3],16777619);}
                      assert(count>1000,action.id+' frame '+f+' visible');hashes.add(hash>>>0);
                    }
                    peakDecodedBytes=Math.max(peakDecodedBytes,pet.assets.stats().bytes);
                    assert(hashes.size>=6,action.id+' has distinct poses');checks.push({id:action.id,frames:asset.durations.length,distinctRenders:hashes.size,naturalRelease:action.type==='staged'?true:null});pet.stop();
                  }
                  return {checks,peakDecodedBytes};
                }''')
                report['actions'] = result['checks']
                report['peakDecodedBytes'] = result['peakDecodedBytes']
                assert len(result['checks']) >= 16, 'The complete proposed action pack has sixteen new actions'
                report['newImages'] = True
                page.evaluate('pipiAnimationGallery.select("stretch");pipiAnimationGallery.pet.autoTick=false')
                page.wait_for_function('pipiAnimationGallery.pet.current?.status==="playing"')
                page.evaluate('pipiAnimationGallery.pet.seek(750)')
                page.screenshot(path=str(OUT / 'gallery.png'), full_page=True)
                report['webPerformance'] = page.evaluate('''async()=>{
                  const {pet}=pipiAnimationGallery;pet.autoTick=true;pet.resume();
                  const task=pet.play('flap',{sustain:true});await task.ready;
                  const times=[],draws=[],draw=pet.renderer.draw.bind(pet.renderer);
                  pet.renderer.draw=(...args)=>{const at=performance.now();const value=draw(...args);draws.push(performance.now()-at);return value;};
                  await new Promise(resolve=>{const timer=setTimeout(done,5000);const off=pet.on('frame',()=>{times.push(performance.now());if(times.length>=120)done();});function done(){clearTimeout(timer);off();resolve();}});
                  pet.renderer.draw=draw;pet.stop();draws.sort((a,b)=>a-b);
                  const elapsed=times[times.length-1]-times[0];
                  return {frames:times.length,elapsedMs:Math.round(elapsed),meanFPS:Math.round((times.length-1)/elapsed*10_000)/10,drawP95Ms:draws[Math.floor(draws.length*.95)],scope:'Headless Chromium, 160px bird; CPU draw time excludes GPU presentation and is not a device benchmark'};
                }''')
            assert not report['errors'], report['errors']
            browser.close()
            if not args.logic_only:
                (ROOT / 'assets/companion/browser-validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    finally:
        server.shutdown()
        (OUT / 'browser.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
