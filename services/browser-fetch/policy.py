"""Reviewed target/readiness policy, independent of the browser backend."""
import ipaddress
import json
import re
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

MAX_DOCUMENT_BYTES = 8 * 1024 * 1024


def reviewed_accounts(registry_path):
    registry = json.loads(Path(registry_path).read_text(encoding="utf-8"))
    return {account for source in registry["sources"]
            if source["platform"] in ("csdn-feed", "toutiao-account") and source["crawl"]["enabled"]
            and source["verification"]["status"] == "verified"
            for account in source.get("authorAllowlist", [])}


def validate_target(url, accounts, *, navigation=False):
    if not isinstance(url, str) or len(url) > 2000:
        raise ValueError("Invalid article URL")
    target = urlsplit(url)
    match = re.fullmatch(r"/([A-Za-z0-9_]+)/article/details/([0-9]+)/?", target.path)
    toutiao = re.fullmatch(r"/article/([0-9]{1,30})/?", target.path)
    if (target.scheme == "https" and target.netloc == "www.toutiao.com" and toutiao
            and any(re.fullmatch(r"MS4wLjAB[A-Za-z0-9_-]{30,}", a) for a in accounts)
            and (navigation or not (target.query or target.fragment))):
        return f"https://www.toutiao.com/article/{toutiao[1]}/"
    if (target.scheme != "https" or target.netloc != "blog.csdn.net" or not match
            or match[1] not in accounts or (not navigation and (target.query or target.fragment))):
        raise ValueError("Article is outside the reviewed registry")
    return urlunsplit(("https", "blog.csdn.net", target.path.rstrip("/"), "", ""))


def resource_allowed(url):
    target = urlsplit(url)
    if target.scheme in ("data", "blob"):
        return True
    host = target.hostname or ""
    if target.scheme not in ("https", "http") or target.username or target.password:
        return False
    if host in ("localhost", "localhost.localdomain") or host.endswith((".localhost", ".local", ".internal")):
        return False
    try:
        return ipaddress.ip_address(host).is_global
    except ValueError:
        return bool(host)


def document_ready(html, target=""):
    # This is a rendering readiness signal, not body extraction or sanitization.
    if target.startswith("https://www.toutiao.com/"):
        return bool(re.search(r'\bclass\s*=\s*["\'][^"\']*\barticle-content\b', html))
    return bool(re.search(r'\bid\s*=\s*["\']content_views["\']', html))
