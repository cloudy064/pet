"""Validate all movement directions and random mode controls in the active demo."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results/random-directions';OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch();page=b.new_page(viewport={'width':1100,'height':1000});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8765/examples/optimization/?profile=webp')
 page.wait_for_function('document.querySelector("#download-progress").textContent.includes("全部下载完成")')
 rows=[]
 for action in ['walk','flight']:
  page.select_option('#action',action)
  for direction in ['n','ne','e','se','s','sw','w','nw']:
   page.select_option('#direction',direction)
   page.wait_for_function('!document.querySelector("#scrub").disabled')
   row=page.evaluate('''()=>{
     const p=pipiOptimization.pet,t=p.current,images=new Set();
     for(let i=0;i<8;i++){p.seek(t.duration*i/8);images.add(p.adapter.canvas.toDataURL());}
     return {direction:t.plan.direction,assets:t.plan.assetIds,renders:images.size};
   }''')
   assert row['direction']==direction and row['renders']>1,(action,direction,row)
   rows.append({'action':action,**row})
 page.select_option('#action','jump');assert page.locator('#direction').is_disabled()
 page.clock.install()
 page.click('#random');page.wait_for_function('pipiOptimization.inspect().ready')
 assert page.evaluate('pipiOptimization.inspect().randomMode')
 chosen=[]
 for _ in range(27):
  action=page.locator('#action').input_value();chosen.append(action)
  if action in ['walk','flight']:
   assert page.evaluate('pipiOptimization.pet.current.plan.direction')==page.locator('#direction').input_value()
  duration=page.evaluate('pipiOptimization.pet.current.duration')
  page.clock.run_for(int(duration)+100)
  page.wait_for_function('(old)=>document.querySelector("#action").value!==old && pipiOptimization.inspect().ready',arg=action)
 assert len(set(chosen))==len(chosen),chosen
 page.click('#pause');state=page.evaluate('pipiOptimization.inspect()')
 page.clock.run_for(10000)
 assert page.evaluate('pipiOptimization.inspect().generation')==state['generation']
 assert page.evaluate('pipiOptimization.inspect().elapsed')==state['elapsed']
 page.click('#pause');page.clock.run_for(10000)
 page.wait_for_function('(g)=>pipiOptimization.inspect().generation>g',arg=state['generation'])
 page.locator('#scrub').fill('100');state=page.evaluate('pipiOptimization.inspect()')
 page.clock.run_for(10000)
 assert page.evaluate('pipiOptimization.inspect().generation')==state['generation']
 page.click('#random');assert not page.evaluate('pipiOptimization.inspect().randomMode')
 page.click('#random');page.wait_for_function('pipiOptimization.inspect().ready')
 page.select_option('#action','wave');page.wait_for_function('pipiOptimization.inspect().ready')
 assert not page.evaluate('pipiOptimization.inspect().randomMode')
 page.clock.run_for(7000);assert page.locator('#action').input_value()=='wave'
 page.screenshot(path=str(OUT/'desktop.png'),full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 report={'directions':rows,'randomActions':chosen,'pauseResume':True,'scrubPauses':True,'manualStopsRandom':True,'errors':errors}
 (OUT/'browser.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
