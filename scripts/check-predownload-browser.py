"""Exercise background predownload, foreground priority, and offline playback after decoded eviction."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results/predownload'
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport={'width':1100,'height':1000})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:8765/examples/optimization/?profile=webp')
    page.wait_for_function('document.querySelector("#download-progress").textContent.includes("全部下载完成")')
    stats = page.evaluate('pipiOptimization.pet.adapter.downloadStats()')
    assert stats['pages'] == 114 and stats['bytes'] == 16393686, stats
    initial_decoded = page.evaluate('pipiOptimization.pet.assets.stats().bytes')
    assert initial_decoded < 10 * 1024 * 1024, initial_decoded
    page.screenshot(path=str(OUT / 'downloaded.png'), full_page=True)
    await_requests = []
    page.on('request', lambda r: await_requests.append(r.url) if '.webp' in r.url and not r.url.startswith('blob:') else None)
    context.set_offline(True)
    actions = page.locator('#action option').evaluate_all('(xs)=>xs.map(x=>x.value)')
    for action in actions:
        page.evaluate('pipiOptimization.pet.assets.trim({all:true})')
        page.select_option('#action', action)
        page.wait_for_function('!document.querySelector("#scrub").disabled', timeout=10000)
        frames = page.evaluate('''()=>{
          const p=pipiOptimization.pet, frames=new Set();
          for(let i=0;i<8;i++){ p.seek(p.current.duration*i/8); frames.add(p.adapter.canvas.toDataURL()); }
          return frames.size;
        }''')
        assert frames > 1, (action, frames)
    assert not await_requests, await_requests
    assert not errors, errors
    context.close()
    context = browser.new_context(viewport={'width':1100,'height':1000})
    page = context.new_page()
    # Hold the first large WebP request (background jump); selecting it must cancel
    # that background consumer and issue a foreground request without waiting.
    page.add_init_script('''(() => {
      const fetch = window.fetch.bind(window);
      window.downloadTest = {held:false,aborted:false};
      window.fetch = (url, opts = {}) => {
        if (!downloadTest.held && String(url).includes('atlas-cb95d1aad74518dcee14.webp')) {
          downloadTest.held = true;
          return new Promise((resolve,reject) => {
            const cancel=()=>{downloadTest.aborted=true;reject(new DOMException('cancelled','AbortError'));};
            opts.signal.addEventListener('abort',cancel,{once:true});
            if(opts.signal.aborted) cancel();
          });
        }
        return fetch(url,opts);
      };
    })();''')
    page.goto('http://127.0.0.1:8765/examples/optimization/?profile=webp')
    page.wait_for_function('downloadTest.held')
    page.select_option('#action', 'jump')
    page.wait_for_function('downloadTest.aborted && !document.querySelector("#scrub").disabled', timeout=5000)
    page.wait_for_function('document.querySelector("#download-progress").textContent.includes("全部下载完成")')
    report = {'cache':stats, 'initialDecodedBytes':initial_decoded, 'offlineActions':actions,
              'offlineImageRequests':0, 'backgroundCancelledForForeground':True, 'errors':errors}
    (OUT/'browser.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))
    browser.close()
