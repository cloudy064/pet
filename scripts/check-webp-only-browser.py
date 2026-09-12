"""Check the active full-action preview loads WebP only and all actions animate."""
from pathlib import Path
import json,re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'test-results/webp-only';OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);page=b.new_page(viewport={'width':1100,'height':1000});requests=[];errors=[]
 page.on('request',lambda r:requests.append(r.url));page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8765/examples/optimization/?profile=webp')
 page.wait_for_function('window.pipiOptimization')
 assert page.locator('canvas').count()==1
 assert page.evaluate('pipiOptimization.pets.length')==1
 rows=[]
 for action in page.locator('#action option').evaluate_all('(xs)=>xs.map(x=>x.value)'):
  page.select_option('#action',action);page.wait_for_function('!document.querySelector("#scrub").disabled')
  result=page.evaluate('''async()=>{
   const p=pipiOptimization.pet,images=new Set(),duration=p.current.duration,start=p.current.elapsed;
   for(let i=0;i<6;i++){images.add(p.adapter.canvas.toDataURL());await new Promise(r=>setTimeout(r,70));}
   const progressed=p.current.elapsed!==start;
   for(let i=0;i<=12;i++){const s=document.querySelector('#scrub');s.value=duration*i/12;s.dispatchEvent(new Event('input'));images.add(p.adapter.canvas.toDataURL());}
   return {progressed,renders:images.size,duration};
  }''')
  assert result['progressed'] and result['renders']>1,(action,result)
  rows.append({'action':action,**result})
 page.select_option('#action','jump');page.wait_for_function('!document.querySelector("#scrub").disabled')
 page.click('#pause');before=page.evaluate('pipiOptimization.pet.current.elapsed');page.wait_for_timeout(100)
 assert page.evaluate('pipiOptimization.pet.current.elapsed')==before
 page.click('#pause');page.wait_for_timeout(100);assert page.evaluate('pipiOptimization.pet.current.elapsed')!=before
 page.screenshot(path=str(OUT/'desktop.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path=str(OUT/'mobile.png'),full_page=True)
 assert not [u for u in requests if re.search(r'\.png(?:\?|$)',u)], requests
 assert not [u for u in requests if '/assets/engine/' in u or '/assets/companion/' in u],requests
 assert not errors,errors
 report={'actions':rows,'pngRequests':0,'singleCanvas':True,'pauseResume':True,'mobileLayout':True,'errors':errors}
 (OUT/'browser.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
