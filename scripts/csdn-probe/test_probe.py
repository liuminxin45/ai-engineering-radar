import unittest
import tempfile
from pathlib import Path
from types import SimpleNamespace
from probe import assess, fetch_one

CASE = {"url": "https://blog.csdn.net/example/article/details/123", "title": "短文", "description": "摘要"}


class CompletenessTest(unittest.TestCase):
    def test_challenge_is_not_article(self):
        row, article = assess('<title>Security check</title><article>验证访问</article>', CASE)
        self.assertFalse(row["accessSuccess"])
        self.assertIsNone(article)

    def test_short_article_is_complete(self):
        row, _ = assess('<h1>短文</h1><div id="content_views"><p>你好。</p></div>', CASE)
        self.assertEqual(row["quality"], "structure_preserved")

    def test_single_image_is_complete(self):
        row, _ = assess('<h1>短文</h1><div id="content_views"><img src="https://example.com/image.png"></div>', CASE)
        self.assertEqual(row["quality"], "structure_preserved")

    def test_summary_is_not_full_article(self):
        row, _ = assess('<h1>短文</h1><div id="content_views">摘要</div>', CASE)
        self.assertIn("matches_rss_summary", row["issues"])

    def test_explicit_restriction_needs_review(self):
        row, _ = assess('<h1>短文</h1><div id="content_views">登录后查看全文</div>', CASE)
        self.assertIn("explicit_reading_restriction", row["issues"])

    def test_wrong_article_title_needs_review(self):
        row, _ = assess('<h1>别的文章</h1><div id="content_views">正文</div>', CASE)
        self.assertIn("title_mismatch", row["issues"])

    def test_code_fences_and_csdn_controls_are_compared_semantically(self):
        row, _ = assess('<h1>短文</h1><div id="content_views"><pre><code>print("hello")</code><div class="opt-box">复制</div><ul class="pre-numbering"><li>1</li></ul></pre><div class="hide-preCode-box"><img src="https://csdnimg.cn/button.png"></div></div>', CASE)
        self.assertEqual(row["quality"], "structure_preserved")
        self.assertEqual(row["extracted"]["codeBlocks"], 1)
        self.assertEqual(row["source"]["images"], 0)


class CaptureRegressionTest(unittest.IsolatedAsyncioTestCase):
    async def capture(self, *, navigation_timeout=False, status=200, screenshot_error=False):
        content = '<h1>短文</h1><div id="content_views"><p>正文。</p></div>'
        class Page:
            main_frame = object()
            def on(self, event, callback): self.callback = callback
            async def goto(self, *a, **kw):
                async def text(): return content
                self.callback(SimpleNamespace(status=status, request=SimpleNamespace(is_navigation_request=lambda: True), frame=self.main_frame, text=text))
                if navigation_timeout: raise TimeoutError('Third-party script stalled DOMContentLoaded')
            async def wait_for_selector(self, *a, **kw): pass
            async def wait_for_timeout(self, *a, **kw): pass
            async def evaluate(self, *a): return {'restrictionVisible': False}
            async def content(self):
                if navigation_timeout: raise AssertionError('Partial DOM must not be used')
                return content
            async def screenshot(self, *a, **kw):
                if screenshot_error: raise RuntimeError('Screenshot exceeds limit')
        class Context:
            async def new_page(self): return Page()
            async def close(self): pass
        class Browser:
            async def new_context(self): return Context()
        args = SimpleNamespace(wait_ms=15, screenshots=screenshot_error)
        with tempfile.TemporaryDirectory() as directory:
            return await fetch_one(Browser(), {**CASE, 'id': 'case', 'sourceId': 'test'}, args, Path(directory))

    async def test_screenshot_failure_preserves_successful_article(self):
        row = await self.capture(screenshot_error=True)
        self.assertTrue(row['accessSuccess'])
        self.assertTrue(row['extractionSuccess'])
        self.assertEqual(row['screenshotError'], 'RuntimeError')

    async def test_complete_browser_response_survives_dom_timeout(self):
        row = await self.capture(navigation_timeout=True)
        self.assertTrue(row['extractionSuccess'])
        self.assertEqual(row['captureMethod'], 'complete_browser_response')

    async def test_521_response_is_never_accepted_as_timeout_recovery(self):
        row = await self.capture(navigation_timeout=True, status=521)
        self.assertFalse(row['accessSuccess'])


if __name__ == "__main__":
    unittest.main()
