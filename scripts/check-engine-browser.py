"""Real Canvas/image checks against the built package and the public studio UI."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import json, os, threading
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results' / 'engine'
class Quiet(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.mjs':'text/javascript', '.js':'text/javascript'}
    def log_message(self, *args): pass

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = 'http://127.0.0.1:%s' % server.server_port
    try:
        with sync_playwright() as p:
            options = {'headless':True, 'args':['--autoplay-policy=no-user-gesture-required']}
            if os.name == 'nt': options['channel'] = 'msedge'
            browser = p.chromium.launch(**options)
            page = browser.new_page(viewport={'width':1440,'height':1150}, device_scale_factor=1)
            errors=[]
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(origin+'/皮皮_引擎工作台.html')
            page.wait_for_function('window.pipiStudio && pipiStudio.pet.status === "ready"')
            page.locator('[data-action="wave"]').click()
            page.locator('#play').click()
            page.wait_for_function('pipiStudio.pet.current && pipiStudio.pet.current.status === "playing"')
            page.evaluate('pipiStudio.pet.pause().seek(1800)')
            page.screenshot(path=str(OUT/'studio-desktop.png'),full_page=True)
            page.locator('#duplicate').click()
            page.locator('#label').fill('浏览器测试动作')
            page.locator('#action-speed').fill('1.4')
            page.locator('#save-fields').click()
            assert page.evaluate('pipiStudio.pet.actions.get("waveCopy1").speed') == 1.4
            with page.expect_download() as download:
                page.locator('#export').click()
            document=OUT/'project-roundtrip.json'
            download.value.save_as(str(document))
            page.locator('#delete').click()
            assert not page.evaluate('pipiStudio.pet.actions.has("waveCopy1")')
            page.locator('#import').set_input_files(str(document))
            page.wait_for_function('pipiStudio.pet.actions.has("waveCopy1")')
            assert page.evaluate('pipiStudio.pet.actions.get("waveCopy1").speed') == 1.4
            # Public pointer events must survive the browser's implicit lostpointercapture.
            page.evaluate('pipiStudio.pet.stopFree({cancel:true}).resume(); pipiStudio.pet.options.autoBlink=false')
            point=page.evaluate('''()=>{const r=document.querySelector('canvas').getBoundingClientRect(),s=pipiStudio.pet.snapshot();return {x:r.left+s.position.x,y:r.top+s.position.y-s.size*.4}}''')
            page.mouse.click(point['x'],point['y'])
            page.wait_for_function('pipiStudio.pet.current && pipiStudio.pet.current.action === "pet" && pipiStudio.pet.current.status === "playing"')
            page.evaluate('pipiStudio.pet.stop()')
            page.mouse.dblclick(point['x'],point['y'],delay=80)
            page.wait_for_timeout(550)
            assert page.evaluate('pipiStudio.pet.current === null')
            page.set_viewport_size({'width':390,'height':844})
            page.wait_for_timeout(250)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            page.screenshot(path=str(OUT/'studio-mobile.png'),full_page=True)
            page.goto(origin+'/examples/web/')
            page.wait_for_function('window.examplePet && examplePet.status === "ready"')
            page.locator('#wave').click()
            page.wait_for_function('examplePet.current && examplePet.current.status === "playing"')
            page.wait_for_function('examplePet.current === null',timeout=12000)
            page.goto(origin+'/皮皮_引擎工作台.html')
            page.wait_for_function('window.pipiStudio && pipiStudio.pet.status === "ready"')
            result=page.evaluate('''async()=>{
              pipiStudio.pet.destroy();
              const canvas=document.createElement('canvas');document.body.replaceChildren(canvas);
              const pet=Pipi.createWebPet(canvas,{width:1200,height:1000,size:136,position:{x:600,y:650},assetBaseURL:'assets/engine',autoTick:false,autoBlink:false,maxMemoryBytes:96*1024*1024});
              await pet.ready;
              const ctx=canvas.getContext('2d'),pixels=()=>{const d=ctx.getImageData(0,0,canvas.width,canvas.height).data;let count=0,minX=canvas.width,minY=canvas.height,maxX=0,maxY=0,hash=2166136261;for(let i=0;i<d.length;i+=4){if(d[i+3]>16){const n=i/4,x=n%canvas.width,y=Math.floor(n/canvas.width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);count++;}hash=Math.imul(hash^d[i],16777619);hash=Math.imul(hash^d[i+3],16777619);}return {count,minX,minY,maxX,maxY,hash:hash>>>0};};
              const checks=[],assert=(ok,text)=>{if(!ok)throw Error(text);};
              const rest=pixels(),sameBounds=(a,b)=>['minX','minY','maxX','maxY'].every(key=>Math.abs(a[key]-b[key])<=1);
              for(const id of ['blink','wave','wink','talk','pet','jump','curious','pointLeft','pointRight']){
                pet.setPosition(600,650);const playback=pet.play(id);await playback.ready;assert(playback.status==='playing',id+' loaded');
                const samples=[];for(let i=0;i<=12;i++){pet.seek(playback.duration*i/12);const sample=pixels();assert(sample.count>3000,id+' visible');assert(sample.minX>0&&sample.minY>0&&sample.maxX<1199&&sample.maxY<999,id+' not clipped');samples.push(sample);}
                assert(sameBounds(samples[0],rest)&&sameBounds(samples.at(-1),rest),id+' starts and ends aligned with the common standing pose');
                assert(new Set(samples.map(s=>s.hash)).size>1,id+' animates');checks.push({id,framesSampled:samples.length,bounds:samples[6]});pet.stop();
              }
              for(const mode of ['walk','flight'])for(const [dir,v] of Object.entries(Pipi.DIRECTIONS)){
                pet.setPosition(600,650);const to={x:600+v[0]*150,y:650+v[1]*150},playback=pet.moveTo(to,{mode});await playback.ready;assert(playback.status==='playing',mode+dir+' loaded');
                for(const t of [0,.25,.5,.75,1]){pet.seek(playback.duration*t);const sample=pixels();assert(sample.count>3000&&sample.minX>0&&sample.minY>0&&sample.maxX<1199&&sample.maxY<999,mode+dir+' visible and bounded');}
                assert(pet.position.x===to.x&&pet.position.y===to.y,mode+dir+' reaches destination');checks.push({id:mode+':'+dir,duration:playback.duration,assets:playback.plan.assetIds});pet.stop();
              }
              pet.setPosition(600,650);const baseline=pixels();const growth=pet.growTo(1.25);await growth.ready;pet.update(growth.duration);const grown=pixels();
              assert(grown.maxY-grown.minY>(baseline.maxY-baseline.minY)*1.2,'growth persists in actual rendered size');
              pet.autoTick=true;const seen=new Set(),off=pet.on('frame',state=>seen.add(state.frame));
              const realtime=pet.play('wave');await realtime.finished;off();pet.autoTick=false;pet.halt();
              assert(seen.size>=45,'real requestAnimationFrame playback visits the wave phases');
              // A tiny silent WAV exercises actual HTMLAudio decode/ended callbacks without a network dependency.
              const samples=2400,wav=new ArrayBuffer(44+samples*2),view=new DataView(wav),bytes=new Uint8Array(wav);
              const ascii=(at,text)=>[...text].forEach((c,i)=>bytes[at+i]=c.charCodeAt(0));
              ascii(0,'RIFF');view.setUint32(4,36+samples*2,true);ascii(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,16000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,samples*2,true);
              const source=URL.createObjectURL(new Blob([wav],{type:'audio/wav'}));let mouthSeen=false;
              const stopMouth=pet.on('frame',state=>{if(state.speaking&&pet.lastState.mouth)mouthSeen=true;});
              pet.autoTick=true;const speech=await pet.speak(source,{gesture:'pointRight'});pet.autoTick=false;pet.halt();stopMouth();URL.revokeObjectURL(source);
              assert(speech.status==='finished'&&mouthSeen&&pet.current===null,'native audio ends, mouth animates, pointing wing closes');
              const cache=pet.assets.stats();pet.destroy();assert(pet.assets.stats().bytes===0,'decoded resources released');
              return {result:'PASS',checks,cache,baseline,grown,realtimeWaveFrames:seen.size,nativeAudio:speech.status};
            }''')
            assert not errors, errors
            (OUT/'browser.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
            print(json.dumps({'result':'PASS','realImageActions':len(result['checks']),'UI':'edit/import/export/tap/doubletap/mobile','pageErrors':errors},ensure_ascii=False))
            browser.close()
    finally:
        server.shutdown();server.server_close()

if __name__ == '__main__': main()
