"""Run: python3 scripts/check-preview.py [base-url]. Requires Python Playwright."""
import json, pathlib, re, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4337'
OUT = pathlib.Path('preview-screenshots'); OUT.mkdir(exist_ok=True)
ROUTES = ['/', '/steam-release/', '/steam-workshop/', '/steam-account-levels/', '/steam-controller-support/', '/steam-deck/']
FORBIDDEN = re.compile(r'research pack|evidence gate|content routing|shared writer|launch_topics|researchresultpath|needs verification|fixture|implementation|internal notes|https?://', re.I)
report = []
with sync_playwright() as pw:
 browser = pw.chromium.launch(headless=True, channel="chrome")
 page = browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 errors = []; page.on('pageerror',lambda err:errors.append(str(err)))
 for width,height in [(1440,1000),(390,844),(360,800)]:
  page.set_viewport_size({'width':width,'height':height})
  for route in ROUTES:
   response=page.goto(BASE+route); page.wait_for_load_state('networkidle')
   assert response.status == 200,(route,response.status)
   assert page.locator('h1').count()==1,route
   assert page.locator('meta[name="description"]').get_attribute('content'),route
   assert page.locator('meta[name="robots"]').get_attribute('content')=='noindex,follow'
   assert page.locator('link[rel="canonical"]').get_attribute('href').endswith(route)
   text=page.locator('body').inner_text(); assert not FORBIDDEN.search(text),(route,FORBIDDEN.search(text))
   assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),(width,route,'overflow')
   for im in page.locator('img').all():
    im.scroll_into_view_if_needed(); im.evaluate('(im)=>im.decode()')
    assert im.evaluate('(im)=>im.naturalWidth>0'),(route,'broken image')
    assert im.get_attribute('src').startswith('/'),(route,'external image')
   for link in page.locator('a[href^="#"]').all():
    target=link.get_attribute('href')[1:]; assert page.locator('[id="'+target+'"]').count(),(route,target)
   page.evaluate('document.activeElement.blur(); scrollTo({top:0,behavior:"instant"})')
   if width in [1440,390] and route in ['/', '/steam-release/', '/steam-workshop/', '/steam-deck/']:
    name=('home' if route=='/' else route.strip('/'))+f'-{width}.png'
    page.screenshot(path=str(OUT/name),full_page=True)
   report.append({'route':route,'width':width,'status':'PASS'})
  if width==390:
   page.goto(BASE+'/');page.wait_for_load_state('networkidle')
   page.locator('.mobile-menu summary').click();assert page.locator('.mobile-menu').get_attribute('open') is not None
   page.screenshot(path=str(OUT/'mobile-nav.png'))
   page.keyboard.press('Escape');assert page.locator('.mobile-menu').get_attribute('open') is None
   page.locator('.mobile-menu summary').click();page.locator('.mobile-menu nav a').filter(has_text='Workshop').click();assert page.url.endswith('/steam-workshop/')
 page.goto(BASE+'/');page.wait_for_load_state('networkidle')
 card=page.locator('.question-card').first;box=card.bounding_box();card.click(position={'x':box['width']-9,'y':box['height']-9});assert page.url.endswith('/steam-release/')
 page.goto(BASE+'/');page.locator('#faq details summary').first.click();assert page.locator('#faq details').first.get_attribute('open') is not None
 page.locator('video').scroll_into_view_if_needed();page.locator('video').evaluate('(video)=>{video.play()}');page.wait_for_function('document.querySelector("video").currentTime > 0', timeout=15000);page.locator('video').evaluate('(video)=>video.pause()')
 page.goto(BASE+'/search/?q=favorites');page.wait_for_load_state('networkidle');assert page.locator('.search-results a:visible').count()>0
 page.locator('#guide-search').fill('no-such-topic-xyz');assert page.locator('#no-results').is_visible()
 response=page.goto(BASE+'/not-a-real-page/');assert response.status==404
 page.set_viewport_size({'width':1440,'height':1000}); page.goto(BASE+'/steam-deck/');page.wait_for_load_state('networkidle')
 assert 'Playable' in page.locator('body').inner_text(); assert 'Not tested' in page.locator('body').inner_text()
 assert not errors,errors
 browser.close()
pathlib.Path('preview-screenshots/browser-check.json').write_text(json.dumps({'checks':report,'interactions':['mobile menu','Escape','nav destination','full-card corner click','FAQ','local video playback','search match and empty state','404'],'page_errors':errors},indent=2))
print(f'PASS: {len(report)} route/viewport checks; nav, whole cards, FAQ, video, search, 404; no page errors.')
