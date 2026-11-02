"""Local HTTP boundary for browser acquisition; protocol version 1."""
import asyncio
import concurrent.futures
import json
import os
import signal
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from camoufox_backend import create_backend, BROWSER_VERSION, PACKAGE_VERSION
from policy import reviewed_accounts, validate_target
from runtime import BrowserDocumentFetcher


def handler_for(loop, fetcher):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # Never log raw request bodies, browser state or proxy options.

        def reply(self, status, data):
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def do_GET(self):
            if self.path == "/healthz":
                return self.reply(200, {"status": "ok", "schemaVersion": 1, "provider": "camoufox", "configuredBrowserVersion": BROWSER_VERSION, "packageVersion": PACKAGE_VERSION})
            self.reply(404, {"error": "Unknown route"})

        def do_POST(self):
            if self.path != "/fetch":
                return self.reply(404, {"error": "Unknown route"})
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 0 < size <= 4096 or self.headers.get_content_type() != "application/json":
                    return self.reply(400, {"error": "Small JSON request required"})
                request = json.loads(self.rfile.read(size))
                if not isinstance(request, dict) or set(request) != {"url"}:
                    raise ValueError("Invalid request")
                target = validate_target(request["url"], fetcher.accounts)
            except (ValueError, TypeError, KeyError):
                return self.reply(400, {"error": "Article is outside the reviewed registry"})
            async def bounded():
                return await asyncio.wait_for(fetcher.fetch(target), timeout=120)
            future = asyncio.run_coroutine_threadsafe(bounded(), loop)
            try:
                result = future.result(timeout=122)
            except (Exception, concurrent.futures.TimeoutError):
                future.cancel()
                return self.reply(502, {"error": "Browser article acquisition failed"})
            self.reply(200, result)
    return Handler


async def main():
    registry = Path(__file__).resolve().parents[2] / "packages/source-registry/registry.json"
    fetcher = BrowserDocumentFetcher(reviewed_accounts(registry), create_backend, BROWSER_VERSION)
    port = int(os.environ.get("BROWSER_FETCH_PORT", "1201"))
    if not 1 <= port <= 65535:
        raise ValueError("Invalid browser service port")
    loop = asyncio.get_running_loop()
    server = ThreadingHTTPServer(("127.0.0.1", port), handler_for(loop, fetcher))
    server.daemon_threads = True
    threading.Thread(target=server.serve_forever, daemon=True).start()
    stopped = asyncio.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, stopped.set)
        except NotImplementedError:
            pass
    print(f"Browser acquisition service listening on 127.0.0.1:{port}", flush=True)
    try:
        await stopped.wait()
    finally:
        server.shutdown()
        await fetcher.close()


if __name__ == "__main__":
    asyncio.run(main())
