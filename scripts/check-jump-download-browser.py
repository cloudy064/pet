"""A stalled third jump WebP must retry and start without a replay click."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results/action-loading';OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);page=b.new_page();errors=[];held=[];attempts=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 pattern='**/atlas-cb95d1aad74518dcee14.webp*'
 def handle(route):
  attempts.append(route.request.url)
  if '_pipiRetry=' in route.request.url: route.continue_()
  else: held.append(route)
 page.route(pattern,handle)
 page.goto('http://127.0.0.1:8765/examples/optimization/comparison.html?profile=webp');page.wait_for_function('window.pipiOptimization')
 page.clock.install();page.select_option('#action','jump')
 page.wait_for_function('pipiOptimization.changed.assets.cache.size>2')
 for _ in range(100):
  if held: break
  page.wait_for_timeout(20)
 assert held,'Third jump page was not requested'
 page.clock.fast_forward(5100)
 page.wait_for_function('!document.querySelector("#scrub").disabled')
 before=page.locator('#after').evaluate('(c)=>c.toDataURL()');page.clock.run_for(300)
 assert before!=page.locator('#after').evaluate('(c)=>c.toDataURL()')
 assert len(attempts)==2,attempts
 assert page.evaluate('pipiOptimization.pets.every(p=>p.current.status==="playing"&&p.current.elapsed>0)')
 assert not errors,errors
 report={'action':'jump','stalledPage':attempts[0],'retryPage':attempts[1],'automaticPlayback':True,'manualReplayClicks':0,'errors':errors}
 (OUT/'jump-download.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
 for route in held:
  try: route.abort()
  except Exception:pass
 page.unroute_all(behavior='ignoreErrors');b.close()
