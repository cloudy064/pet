"""Check the exported action and its real browser open/hold/close controls."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--allow-file-access-from-files'])
    page=browser.new_page(viewport={'width':1320,'height':1100})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto((ROOT/'皮皮_指字调试台.html').as_uri())
    page.wait_for_function('window.PipiPointDebug?.snapshot().ready')
    page.uncheck('#pointSpeaking')
    initial=page.evaluate('pointCanvas.toDataURL()')
    page.click('#pointOpen')
    page.wait_for_function('PipiPointDebug.snapshot().frame===18')
    held=page.evaluate('pointCanvas.toDataURL()')
    assert held!=initial
    page.wait_for_timeout(400)
    assert held==page.evaluate('pointCanvas.toDataURL()')
    page.click('#pointPause');page.click('#pointPause');page.wait_for_timeout(200)
    assert page.evaluate('PipiPointDebug.snapshot().mode')=='hold'
    assert held==page.evaluate('pointCanvas.toDataURL()')
    page.click('#pointClose')
    page.wait_for_function('PipiPointDebug.snapshot().frame===36 && PipiPointDebug.snapshot().mode==="paused"')
    assert initial==page.evaluate('pointCanvas.toDataURL()')
    playback=page.evaluate('''() => new Promise(resolve=>{
      const seen=new Set([0]);let prior=0;const skips=[];pointPlay.click();
      function sample(){const s=PipiPointDebug.snapshot();seen.add(s.frame);
        if(s.frame>prior+1)skips.push([prior,s.frame]);prior=s.frame;
        if(s.mode==='paused')resolve({frames:seen.size,skips});else requestAnimationFrame(sample);}
      requestAnimationFrame(sample);
    })''')
    assert playback=={'frames':37,'skips':[]},playback
    page.evaluate('pointSeek.value=7;pointSeek.dispatchEvent(new Event("input"))')
    intermediate=page.evaluate('pointCanvas.toDataURL()')
    page.click('#pointClose')
    # Reverse from the current pose, without jumping directly to full extension.
    assert page.evaluate('PipiPointDebug.snapshot().sourceFrame')<=7
    page.wait_for_function('PipiPointDebug.snapshot().mode==="paused"')
    assert initial==page.evaluate('pointCanvas.toDataURL()')
    page.evaluate('pointHold.value=.5;pointHold.dispatchEvent(new Event("input"))')
    assert page.evaluate('PipiPointDebug.snapshot().duration')==2000
    page.evaluate('pointSeek.value=18;pointSeek.dispatchEvent(new Event("input"))')
    page.screenshot(path=str(ROOT/'point-preview.png'))
    for side in ['left','right']:
        page.select_option('#pointSide',side)
        page.click('#pointOpen');page.wait_for_function('PipiPointDebug.snapshot().frame===18')
        wing=page.evaluate('pointCanvas.toDataURL()')
        page.check('#pointSpeaking');page.wait_for_timeout(200)
        assert wing!=page.evaluate('pointCanvas.toDataURL()')
        page.uncheck('#pointSpeaking');assert wing==page.evaluate('pointCanvas.toDataURL()')
        page.screenshot(path=str(ROOT/('point-'+side+'-preview.png')))
    page.set_viewport_size({'width':390,'height':844})
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(ROOT/'point-mobile-preview.png'))
    assert not errors,errors
    browser.close()
report={'result':'PASS','nativePlayback':playback,'holdStable':True,'neutralEndpointsExact':True,
        'earlyClose':True,'pauseKeepsHoldMode':True,'configurableHold':True,'mobileOverflow':False}
(ROOT/'point-browser-check.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
