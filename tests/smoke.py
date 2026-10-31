from playwright.sync_api import sync_playwright
import sys
url='file:///home/claude/proj/dist-single/index.html'
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900})
    errs=[]; pg.on('pageerror',lambda e:errs.append('PAGEERROR '+str(e)[:200]))
    pg.on('console',lambda m: errs.append('console.error '+m.text[:150]) if m.type=='error' and 'ERR_NAME_NOT_RESOLVED' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.goto(url); pg.wait_for_timeout(2500)
    n=pg.locator('aside button, nav button').count()
    print('sidebar buttons:',n)
    labels=[]
    for i in range(n):
        btn=pg.locator('aside button, nav button').nth(i)
        try:
            t=(btn.inner_text(timeout=1000) or '').strip().split('\n')[0][:30]
            btn.click(timeout=2000); pg.wait_for_timeout(500)
            blank = pg.evaluate("document.getElementById('root').innerText.trim().length")<50
            labels.append((t,'BLANK' if blank else 'ok'))
        except Exception as e:
            labels.append((str(i),'skip'))
    print(labels)
    print('errors:',errs[:8] if errs else 'none')
    b.close()
