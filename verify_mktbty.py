import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        path = "file://" + os.path.abspath("index.html")
        await page.goto(path)

        # Check if app is visible
        app_visible = await page.is_visible("#app")
        print(f"App visible: {app_visible}")

        # Switch to Maarif
        await page.click("#nav-toggle button:has-text('المعارف')")
        maarif_active = await page.is_visible("#page-maarif.active")
        print(f"Maarif section active: {maarif_active}")

        # Switch to Library
        await page.click("#nav-toggle button:has-text('مكتبتي')")
        library_active = await page.is_visible("#page-library.active")
        print(f"Library section active: {library_active}")

        # Switch to Profile
        await page.click("button[title='حسابي']")
        profile_active = await page.is_visible("#page-profile.active")
        print(f"Profile section active: {profile_active}")

        # Take a screenshot of Maarif to see the cinematic look
        await page.click("#nav-toggle button:has-text('المعارف')")
        await page.screenshot(path="maarif_view.png")
        print("Screenshot saved to maarif_view.png")

        await browser.close()

asyncio.run(run())
