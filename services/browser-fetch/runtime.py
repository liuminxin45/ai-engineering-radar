"""Bounded document acquisition. No article parsing, Markdown or persistence."""
import asyncio
from policy import MAX_DOCUMENT_BYTES, validate_target, resource_allowed, document_ready


class BrowserDocumentFetcher:
    def __init__(self, accounts, factory, expected_version):
        self.accounts = accounts
        self.factory = factory
        self.expected_version = expected_version
        self.browser = None
        self.manager = None
        self.start_lock = asyncio.Lock()
        self.slots = asyncio.Semaphore(2)

    async def get_browser(self):
        async with self.start_lock:
            if self.browser is None:
                self.manager = self.factory()
                try:
                    self.browser = await self.manager.__aenter__()
                    if self.browser.version != self.expected_version:
                        raise RuntimeError("Browser version differs from the pinned version")
                except BaseException:
                    await self.close()
                    raise
            return self.browser

    async def close(self):
        manager, self.manager = self.manager, None
        self.browser = None
        if manager:
            await manager.__aexit__(None, None, None)

    async def fetch(self, url):
        target = validate_target(url, self.accounts)
        async with self.slots:
            browser = await self.get_browser()
            for attempt in range(2):
                try:
                    document = await self.fetch_once(browser, target)
                    return {"schemaVersion": 1, "document": document}
                except asyncio.CancelledError:
                    raise
                except Exception:
                    if attempt:
                        raise RuntimeError("Browser did not obtain a complete reviewed article") from None
                    await asyncio.sleep(2)

    async def fetch_once(self, browser, target):
        context = await browser.new_context()
        try:
            page = await context.new_page()
            responses = []
            def navigation(response):
                if response.request.is_navigation_request() and response.frame == page.main_frame:
                    responses.append(response)
            page.on("response", navigation)
            async def guard(route):
                request = route.request
                allowed = resource_allowed(request.url)
                if request.is_navigation_request() and request.frame == page.main_frame:
                    try:
                        allowed = validate_target(request.url, self.accounts, navigation=True) == target
                    except ValueError:
                        allowed = False
                await (route.continue_() if allowed else route.abort())
            await page.route("**/*", guard)
            html = None
            try:
                await page.goto(target, wait_until="domcontentloaded", timeout=25_000)
            except Exception:
                if not responses or responses[-1].status != 200:
                    raise
                html = await asyncio.wait_for(responses[-1].text(), timeout=10)
                if not document_ready(html, target):
                    # Dynamic pages may hydrate after their first 200 response.
                    html = None
            if html is None:
                try:
                    selector = ".article-content" if "www.toutiao.com/" in target else "#content_views"
                    await page.wait_for_selector(selector, state="attached", timeout=15_000)
                except Exception:
                    pass
                await page.wait_for_timeout(1000)
                html = await page.content()
            final_url = validate_target(page.url, self.accounts, navigation=True)
            if (final_url != target or not responses or responses[-1].status != 200
                    or not document_ready(html, target) or len(html.encode("utf-8")) > MAX_DOCUMENT_BYTES):
                raise RuntimeError("Browser returned no usable article document")
            if target.startswith("https://www.toutiao.com/") and not any(
                    account.startswith("MS4wLjAB") and f"/c/user/token/{account}/" in html
                    for account in self.accounts):
                raise RuntimeError("Article does not identify a reviewed account")
            return {"url": target, "content": html, "format": "html"}
        finally:
            await context.close()
