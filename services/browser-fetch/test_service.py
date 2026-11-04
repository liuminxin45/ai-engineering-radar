import asyncio
import json
import threading
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from http.server import ThreadingHTTPServer
from policy import validate_target, resource_allowed
from runtime import BrowserDocumentFetcher
from server import handler_for

URL = "https://blog.csdn.net/example/article/details/123"
HTML = '<h1>短文</h1><div id="content_views"><p>正文。</p></div>'


class Page:
    main_frame = object()
    url = URL
    timeout = False
    html = HTML
    status = 200
    def on(self, event, callback): self.callback = callback
    async def route(self, *args): pass
    async def goto(self, *args, **kwargs):
        async def text(): return self.html
        self.callback(SimpleNamespace(status=self.status, request=SimpleNamespace(is_navigation_request=lambda: True), frame=self.main_frame, text=text))
        if self.timeout: raise TimeoutError("Page completion stalled")
    async def wait_for_selector(self, *args, **kwargs): pass
    async def wait_for_timeout(self, *args): pass
    async def content(self): return self.html


class Backend:
    version = "pinned"
    def __init__(self, page_type=Page): self.page_type, self.contexts = page_type, []
    async def __aenter__(self): return self
    async def __aexit__(self, *args): pass
    async def new_context(self):
        context = SimpleNamespace(closed=False)
        async def new_page(): return self.page_type()
        async def close(): context.closed = True
        context.new_page, context.close = new_page, close
        self.contexts.append(context)
        return context


class PolicyTests(unittest.TestCase):
    def test_only_reviewed_exact_article_targets(self):
        self.assertEqual(validate_target(URL, {"example"}), URL)
        for value in [URL.replace('example','other'), URL+'?x=1', URL+'#x', URL.replace('https:','http:'), URL.replace('blog.csdn.net','blog.csdn.net:443'), 'http://127.0.0.1/']:
            with self.assertRaises(ValueError): validate_target(value, {"example"})

    def test_private_resource_urls_are_blocked(self):
        for url in ['http://localhost/a','http://127.0.0.1/a','http://192.168.1.1/','http://[::1]/','http://metadata.internal/']:
            self.assertFalse(resource_allowed(url))
        self.assertTrue(resource_allowed('https://g.csdnimg.cn/script.js'))

    def test_toutiao_requires_a_reviewed_account_and_exact_article_url(self):
        target = 'https://www.toutiao.com/article/7703892274039669290/'
        token = 'MS4wLjABAAAAVKlHQZBJGZmdsWK7YD2J35tCaIoSsZnMTKNkAzw6qEE'
        self.assertEqual(validate_target(target, {token}), target)
        for url, accounts in [(target, {'example'}), (target + '?x=1', {token}),
                              (target.replace('/article/', '/video/'), {token})]:
            with self.assertRaises(ValueError): validate_target(url, accounts)


class RuntimeTests(unittest.IsolatedAsyncioTestCase):
    async def test_reuses_backend_but_closes_each_context(self):
        backend = Backend()
        factory = unittest.mock.Mock(return_value=backend)
        fetcher = BrowserDocumentFetcher({'example'}, factory, 'pinned')
        a,b = await asyncio.gather(fetcher.fetch(URL),fetcher.fetch(URL))
        self.assertEqual(a['document']['content'],HTML)
        self.assertEqual(b['document']['url'],URL)
        self.assertEqual(factory.call_count,1)
        self.assertTrue(all(c.closed for c in backend.contexts))
        await fetcher.close()

    async def test_recovers_complete_200_response_after_navigation_timeout(self):
        class TimedOutPage(Page):
            timeout=True
            async def content(self): raise AssertionError('Partial DOM must not be used')
        fetcher=BrowserDocumentFetcher({'example'},lambda:Backend(TimedOutPage),'pinned')
        self.assertEqual((await fetcher.fetch(URL))['document']['content'],HTML)
        await fetcher.close()

    async def test_challenges_retry_and_are_never_success(self):
        class Challenge(Page): html='<title>Access check</title>';status=521
        backend=Backend(Challenge)
        fetcher=BrowserDocumentFetcher({'example'},lambda:backend,'pinned')
        with patch('runtime.asyncio.sleep',new=AsyncMock()):
            with self.assertRaises(RuntimeError):await fetcher.fetch(URL)
        self.assertEqual(len(backend.contexts),2)
        self.assertTrue(all(c.closed for c in backend.contexts))
        await fetcher.close()

    async def test_cancellation_closes_context(self):
        entered=asyncio.Event()
        class Slow(Page):
            async def goto(self,*a,**kw):entered.set();await asyncio.Event().wait()
        backend=Backend(Slow)
        fetcher=BrowserDocumentFetcher({'example'},lambda:backend,'pinned')
        task=asyncio.create_task(fetcher.fetch(URL));await entered.wait();task.cancel()
        with self.assertRaises(asyncio.CancelledError):await task
        self.assertTrue(backend.contexts[0].closed)
        await fetcher.close()


class HttpTests(unittest.IsolatedAsyncioTestCase):
    async def test_protocol_routes_and_target_rejection(self):
        async def fetch(url):return {'schemaVersion':1,'document':{'url':url,'content':HTML,'format':'html'}}
        fake=SimpleNamespace(accounts={'example'},fetch=fetch)
        server=ThreadingHTTPServer(('127.0.0.1',0),handler_for(asyncio.get_running_loop(),fake))
        threading.Thread(target=server.serve_forever,daemon=True).start()
        base=f'http://127.0.0.1:{server.server_port}'
        def post(url):
            request=Request(base+'/fetch',data=json.dumps({'url':url}).encode(),headers={'Content-Type':'application/json'})
            with urlopen(request,timeout=5) as response:return json.load(response)
        try:
            data=await asyncio.to_thread(post,URL)
            self.assertEqual(data['document']['content'],HTML)
            with self.assertRaises(HTTPError) as error:await asyncio.to_thread(post,URL.replace('example','other'))
            self.assertEqual(error.exception.code,400)
            with await asyncio.to_thread(urlopen,base+'/healthz') as response:self.assertEqual(json.load(response)['schemaVersion'],1)
        finally:
            await asyncio.to_thread(server.shutdown)
            server.server_close()


if __name__ == '__main__': unittest.main()
