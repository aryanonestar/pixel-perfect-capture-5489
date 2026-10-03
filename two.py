import asyncio
from playwright.async_api import async_playwright
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch();pg=await b.new_page()
    await pg.goto("http://localhost:8080/reader.html");await pg.set_input_files("input[type=file]","/tmp/browser/r/two.pdf")
    await pg.wait_for_timeout(4000)
    w=await pg.evaluate("wordMap.map(x=>x.word).join(' ')")
    print(w[:200]);print('...',w[w.find('Left29'):w.find('Left29')+80])
    await b.close()
asyncio.run(m())
