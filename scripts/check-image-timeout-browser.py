"""Verify hung image deadlines and recovery using Chromium's virtual clock."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results/action-loading'
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width':1200,'height':1100})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    held = []
    pattern = '**/assets/companion/runtime/dance-*.png*'
    page.route(pattern, lambda route: held.append(route))
    page.goto('http://127.0.0.1:8765/examples/optimization/comparison.html?profile=webp')
    page.wait_for_function('window.pipiOptimization')
    page.evaluate('pipiOptimization.pets.forEach(p=>(p.adapter.imageStallTimeoutMs=300000,p.adapter.imageSlowTimeoutMs=300000))')
    page.clock.install()
    page.select_option('#action', 'dance')
    page.wait_for_function('pipiOptimization.changed.current?.status === "playing"')
    assert held
    page.clock.fast_forward(120100)
    page.wait_for_function('document.querySelector("#before-status").textContent.includes("自动重试")')
    page.clock.fast_forward(60500)
    page.wait_for_function('document.querySelector("#notice").textContent.includes("超过 3 分钟")')
    assert page.evaluate('pipiOptimization.original.assets.stats().pending') == 0
    assert page.evaluate('pipiOptimization.changed.current.status') == 'playing'
    before = page.locator('#after').evaluate('(c)=>c.toDataURL()')
    page.clock.run_for(300)
    assert before != page.locator('#after').evaluate('(c)=>c.toDataURL()')
    page.screenshot(path=str(OUT / 'timeout.png'), full_page=True)
    for route in held:
        try: route.abort()
        except Exception: pass
    page.unroute_all(behavior="ignoreErrors")
    page.click('#play')
    page.wait_for_function('!document.querySelector("#scrub").disabled')
    assert '已同步' in page.locator('#notice').inner_text()
    assert not errors, errors
    report = {'imageRetryAt120Seconds': True, 'actionStopsAt180Seconds': True,
              'otherSideKeepsAnimating': True, 'manualRetryRecovers': True, 'errors': errors}
    (OUT / 'timeout-browser.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report))
    browser.close()
