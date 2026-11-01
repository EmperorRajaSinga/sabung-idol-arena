from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1400,'height':900}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    pg.on('console',lambda m: errs.append(m.text[:150]) if m.type=='error' and 'Failed to load resource' not in m.text and 'ERR_NAME' not in m.text else None)
    pg.goto('file:///home/claude/proj/dist-single/index.html'); pg.wait_for_timeout(2500)
    pg.get_by_role('button', name='Cups & Divisions').first.click(); pg.wait_for_timeout(800)
    txt=pg.evaluate("document.body.innerText")
    for k in ['Cups & Divisions','Competition names','Challenger Division','Promotion and relegation','Crown Cup','Open Arena Cup','Spotlight Cup','Super Cups']:
        print(('OK  ' if k in txt else 'MISS'),k)
    pg.get_by_label('Capacity per league') if False else None
    # rename a competition and make sure it persists across reload
    box=pg.locator("input[value='Crown Cup']"); box.fill('Apex Crown'); pg.wait_for_timeout(200)
    pg.reload(); pg.wait_for_timeout(2000); pg.get_by_role('button', name='Cups & Divisions').first.click(); pg.wait_for_timeout(600)
    print('rename persisted:', 'Apex Crown' in pg.evaluate("document.body.innerText"))
    print('errors:', errs or 'none'); pg.screenshot(path='/home/claude/shot_v5.png'); b.close()
