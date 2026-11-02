import unittest
from probe import assess

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


if __name__ == "__main__":
    unittest.main()
