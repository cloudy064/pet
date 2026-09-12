"""Decoded images must start playback even when their load notification is missing."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'test-results/action-loading'
OUT.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    # Keep actual browser requests, image decoding and canvas rendering. Only
    # withhold the load event from the SDK, reproducing its previous dead wait.
    page.add_init_script('''(()=>{
      const NativeImage=window.Image;
      window.Image=function(...args){
        const image=new NativeImage(...args);let handler;
        Object.defineProperty(image,'onload',{get:()=>handler,set:fn=>{handler=fn;}});
        return image;
      };
    })();''')
    page.goto('http://127.0.0.1:8765/examples/optimization/comparison.html?profile=webp')
    page.wait_for_function('window.pipiOptimization')
    rows = []
    for action in ['flight','bath','dance','jump','bath']:
        page.select_option('#action', action)
        page.wait_for_function('!document.querySelector("#scrub").disabled')
        before = page.locator('#after').evaluate('(c)=>c.toDataURL()')
        page.wait_for_timeout(350)
        assert before != page.locator('#after').evaluate('(c)=>c.toDataURL()'), action
        assert page.evaluate('pipiOptimization.pets.every(p=>p.current.status === "playing" && p.current.elapsed>0)'), action
        rows.append(action)
    assert not errors, errors
    report = {'missingLoadEventAutomaticPlayback': rows, 'manualReplayClicks': 0, 'errors': errors}
    (OUT/'decoded-playback.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report))
    browser.close()
