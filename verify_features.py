import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        path = "file://" + os.path.abspath("index.html")
        await page.goto(path)

        # Go to Maarif and trigger isnad analysis (no network dependencies)
        await page.click("#nav-toggle button:has-text('المعارف')")
        await page.fill("#maarif-isnad-input", "حدثنا يحيى بن بكير قال حدثنا الليث عن عقيل عن ابن شهاب")
        await page.click("text=بدء التحليل الذكي")

        # Wait for simulation timeout (1s)
        await asyncio.sleep(1.5)
        results_visible = await page.is_visible("#maarif-isnad-results")
        rank_title = await page.inner_text("#maarif-rank-title")
        print(f"Maarif results visible: {results_visible}, Rank: {rank_title}")

        # Switch to Library and check UI state
        await page.click("#nav-toggle button:has-text('مكتبتي')")
        sidebar_visible = await page.is_visible("#lib-sidebar")
        print(f"Library sidebar visible: {sidebar_visible}")

        await browser.close()

asyncio.run(run())
