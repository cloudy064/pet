"""Click known points on the standing pose across sizes/DPR, and exercise touch and drag rejection."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'test-results/body-click';OUT.mkdir(parents=True,exist_ok=True)
PARTS=[('head',0,.3,'pet'),('belly',0,.72,'jump'),('feet',.13,.95,'dance'),('wings',.22,.72,'flap')]
with sync_playwright() as p:
 b=p.chromium.launch();rows=[];errors=[]
 for dpr in [1,2]:
  context=b.new_context(viewport={'width':1100,'height':1100},device_scale_factor=dpr,has_touch=True)
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8765/examples/optimization/?profile=webp')
  page.wait_for_function('document.querySelector("#download-progress").textContent.includes("全部下载完成")')
  def prepare(size):
   page.select_option('#action','blink');page.select_option('#size',str(size));page.wait_for_function('pipiOptimization.inspect().ready')
   page.click('#pause');page.evaluate('pipiOptimization.pet.seek(0)');page.locator('#after').scroll_into_view_if_needed()
  def point(x,y):
   return page.evaluate('''([x,y])=>{const p=pipiOptimization.pet,s=p.lastState,r=document.querySelector('#after').getBoundingClientRect();
    const q={x:s.x+x*s.size,y:s.y-(s.altitude||0)-s.size+y*s.size};
    return {x:r.x+q.x*r.width/p.width,y:r.y+q.y*r.height/p.height,part:p.hitTestPart(q)};}''',[x,y])
  for size in [58,112,216]:
   for part,x,y,action in PARTS:
    prepare(size);q=point(x,y);assert q['part']==part,(size,dpr,part,q)
    page.mouse.click(q['x'],q['y']);page.wait_for_function('(action)=>pipiOptimization.inspect().ready && document.querySelector("#action").value===action',arg=action)
    rows.append({'size':size,'dpr':dpr,'part':part,'action':action})
  prepare(112);q=point(0,.3)
  page.touchscreen.tap(q['x'],q['y']);page.wait_for_function('document.querySelector("#action").value==="pet" && pipiOptimization.inspect().ready')
  prepare(112);q=point(0,.3);generation=page.evaluate('pipiOptimization.inspect().generation')
  page.mouse.move(q['x'],q['y']);page.mouse.down();page.mouse.move(q['x']+30,q['y']);page.mouse.move(q['x'],q['y']);page.mouse.up()
  assert page.evaluate('pipiOptimization.inspect().generation')==generation
  blank=point(.45,.1);assert blank['part'] is None
  page.mouse.click(blank['x'],blank['y']);assert page.evaluate('pipiOptimization.inspect().generation')==generation
  # Translate the current pose and raise it: canvas pixels and hit coordinates move together.
  page.evaluate('''()=>{const p=pipiOptimization.pet,s={...p.lastState,x:180,y:350,altitude:60};
   p.renderer.draw(s,p.current.lease.assets);p.lastState=s;}''')
  for part,x,y,action in PARTS: assert point(x,y)['part']==part
  page.screenshot(path=str(OUT/f'dpr-{dpr}.png'),full_page=True)
  context.close()
 assert not errors,errors
 report={'clicks':rows,'touch':True,'dragIgnored':True,'transparentIgnored':True,'translationAndAltitude':True,'errors':errors}
 (OUT/'browser.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
