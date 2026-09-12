"""Exercise action switching, slow images and retries in the real comparison page."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results/action-loading'
OUT.mkdir(parents=True, exist_ok=True)
URL = 'http://127.0.0.1:8765/examples/optimization/comparison.html?profile=webp'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1200, 'height': 1050})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_function('window.pipiOptimization')
    rows = []
    for action in page.locator('#action option').evaluate_all('(xs)=>xs.map(x=>x.value)'):
        page.select_option('#action', action)
        page.wait_for_function('!document.querySelector("#scrub").disabled')
        result = page.evaluate('''async()=>{
          const pets=pipiOptimization.pets;
          const hashes=pets.map(()=>new Set());
          const start=pets[0].current.elapsed;
          for(let i=0;i<8;i++){
            await new Promise(r=>setTimeout(r,60));
            pets.forEach((pet,j)=>hashes[j].add(pet.adapter.canvas.toDataURL()));
          }
          const progressed=pets[0].current.elapsed!==start;
          document.querySelector('#pause').click();
          const duration=pets[0].current.duration;
          for(let i=0;i<=12;i++){
            const slider=document.querySelector('#scrub');slider.value=i*duration/12;
            slider.dispatchEvent(new Event('input'));
            pets.forEach((pet,j)=>hashes[j].add(pet.adapter.canvas.toDataURL()));
          }
          return {progressed,distinct:hashes.map(x=>x.size),duration,
            synchronized:pets[0].current.elapsed===pets[1].current.elapsed};
        }''')
        assert result['progressed'] and result['synchronized'], (action, result)
        assert min(result['distinct']) > 1, (action, result)
        rows.append({'action': action, **result})
    page.screenshot(path=str(OUT / 'actions.png'), full_page=True)
    page.close()

    # Hold the large original PNG indefinitely; WebP must still visibly animate.
    page = browser.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    held = []
    page.route('**/assets/companion/runtime/dance-*.png*', lambda route: held.append(route))
    page.goto(URL)
    page.wait_for_function('window.pipiOptimization')
    page.select_option('#action', 'dance')
    page.wait_for_function('pipiOptimization.changed.current?.status === "playing"')
    assert page.evaluate('pipiOptimization.original.current.status') == 'loading'
    before = page.locator('#after').evaluate('(c)=>c.toDataURL()')
    page.wait_for_timeout(400)
    assert before != page.locator('#after').evaluate('(c)=>c.toDataURL()')
    assert '正在下载' in page.locator('#before-status').inner_text()
    page.screenshot(path=str(OUT / 'slow-original-preview.png'), full_page=True)
    for route in held:
        route.continue_()
    page.wait_for_function('!document.querySelector("#scrub").disabled')
    assert page.evaluate('pipiOptimization.pets[0].current.elapsed === pipiOptimization.pets[1].current.elapsed')
    # More than a full cycle should remain animated rather than returning to idle.
    duration = page.evaluate('pipiOptimization.changed.current.duration')
    page.wait_for_timeout(duration + 100)
    assert page.evaluate('pipiOptimization.pets.every(p=>p.current?.status === "playing")')
    page.close()

    page = browser.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/assets/companion/runtime/dance-*.png*', lambda route: route.abort())
    page.goto(URL)
    page.wait_for_function('window.pipiOptimization')
    page.select_option('#action', 'dance')
    page.wait_for_function('document.querySelector("#before-status").textContent.includes("失败")')
    page.wait_for_function('pipiOptimization.changed.current?.elapsed > 0')
    page.unroute('**/assets/companion/runtime/dance-*.png*')
    page.click('#play')
    page.wait_for_function('!document.querySelector("#scrub").disabled')
    assert '已同步' in page.locator('#notice').inner_text()
    # Fast replacements must settle only the most recent UI selection.
    page.evaluate('''()=>{for(const id of ['walk','flight','kiss','jump','wave']){
      document.querySelector('#action').value=id;pipiOptimization.play();
    }}''')
    page.wait_for_function('!document.querySelector("#scrub").disabled')
    assert page.evaluate('pipiOptimization.pets.every(p=>p.current.action === "wave")')
    page.wait_for_function('pipiOptimization.pets.every(p=>p.assets.stats().pending === 0)')
    assert not errors, errors
    report = {'actions': rows, 'slowOriginalPreview': True, 'resynchronized': True,
              'loopedFullAction': True, 'failedImageRetry': True, 'rapidSwitch': True, 'errors': errors}
    (OUT / 'browser.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    browser.close()
