"""Reproduce the logged jump transfer: a fast prefix followed by tiny trickles."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'test-results/action-loading';OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('''(()=>{
  const realFetch=window.fetch.bind(window);
  window.fetch=async(input,options)=>{
    const response=await realFetch(input,options),url=String(input);
    if(!url.includes('atlas-cb95d1aad74518dcee14.webp')||url.includes('_pipiRetry='))return response;
    const bytes=new Uint8Array(await response.arrayBuffer());
    const body=new ReadableStream({start(c){
      let offset=199804,closed=false;c.enqueue(bytes.slice(0,offset));
      const timer=setInterval(()=>{const end=Math.min(offset+2664,bytes.length);c.enqueue(bytes.slice(offset,end));offset=end;
        if(offset===bytes.length){closed=true;clearInterval(timer);c.close();}},1000);
      options.signal.addEventListener('abort',()=>{if(!closed){closed=true;clearInterval(timer);c.error(new DOMException('Aborted','AbortError'));}},{once:true});
    }});
    window.slowJumpInstalled=true;
    return new Response(body,{status:200,headers:response.headers});
  };
 })();''')
 page.goto('http://127.0.0.1:8765/examples/optimization/comparison.html?profile=webp');page.wait_for_function('window.pipiOptimization');page.clock.install()
 page.select_option('#action','jump');page.wait_for_function('window.slowJumpInstalled')
 assert page.evaluate('!pipiOptimization.original.current'), 'Original download competed with WebP'
 page.clock.run_for(5200)
 page.wait_for_function('!document.querySelector("#scrub").disabled')
 traces=page.evaluate('pipiTrace.entries')
 retry=next(e for e in traces if e['event']=='image-retry' and e['side']=='after')
 ready=next(e for e in traces if e['event']=='engine-start' and e['side']=='after' and e.get('action')=='jump')
 raw=next(e for e in traces if e['event']=='image-start' and e['side']=='before' and 'base-jump' in e.get('url',''))
 assert raw['ms']>=ready['ms']
 assert retry['ms']<10000,retry
 before=page.locator('#after').evaluate('(c)=>c.toDataURL()');page.clock.run_for(300)
 assert before!=page.locator('#after').evaluate('(c)=>c.toDataURL()')
 assert not errors,errors
 report={'slowTailRetryMs':retry['ms'],'optimizedStartedMs':ready['ms'],'originalStartedMs':raw['ms'],'manualReplayClicks':0,'errors':errors}
 (OUT/'jump-slow-tail.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
