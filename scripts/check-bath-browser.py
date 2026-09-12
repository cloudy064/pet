"""Check bath closing frames in the actual WebP comparison renderer."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'test-results/bath'
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    results = []
    for dpr in [1, 2]:
        page = browser.new_page(viewport={'width':1200,'height':1100}, device_scale_factor=dpr)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:8765/examples/optimization/comparison.html?profile=webp')
        page.wait_for_function('window.pipiOptimization')
        page.evaluate('dpr=>pipiOptimization.pets.forEach(p=>p.resize(550,550,dpr))', dpr)
        page.select_option('#action', 'bath')
        page.wait_for_function('!document.querySelector("#scrub").disabled')
        for size in ['58', '112', '216']:
            page.select_option('#size', size)
            page.wait_for_function('!document.querySelector("#scrub").disabled')
            page.click('#pause')
            for time in [2465, 2510]:  # closing logical frames 19 and 20
                page.evaluate('t=>{const s=document.querySelector("#scrub");s.value=t;s.dispatchEvent(new Event("input"))}', time)
                result = page.evaluate('''()=>pipiOptimization.pets.map(p=>{
                  const c=p.adapter.canvas, a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
                  const seen=new Uint8Array(c.width*c.height);let components=[];
                  for(let i=0;i<seen.length;i++){
                    if(seen[i]||a[i*4+3]<=32)continue;
                    let stack=[i],n=0;seen[i]=1;
                    while(stack.length){const j=stack.pop();n++;
                      const adjacent=[];if(j%c.width)adjacent.push(j-1);if(j%c.width<c.width-1)adjacent.push(j+1);
                      if(j>=c.width)adjacent.push(j-c.width);if(j+c.width<seen.length)adjacent.push(j+c.width);
                      for(const k of adjacent)if(!seen[k]&&a[k*4+3]>32){seen[k]=1;stack.push(k);}
                    }if(n>8)components.push(n);
                  }
                  return {frame:p.snapshot().frame,components};
                })''')
                assert all(r['frame'] in [19,20] and len(r['components']) == 1 for r in result), (dpr,size,time,result)
                results.append({'dpr':dpr,'size':size,'time':time,'renders':result})
                if size == '216' and dpr == 1:
                    page.screenshot(path=str(OUT/f'close-{result[0]["frame"]}.png'), full_page=True)
        assert not errors, errors
        page.close()
    (OUT/'browser.json').write_text(json.dumps(results, indent=2)+'\n')
    print(f'PASS: {len(results)*2} PNG/WebP closing-frame renders, three sizes, two DPRs')
    browser.close()
