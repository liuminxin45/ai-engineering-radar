"""Only this module knows Camoufox. The HTTP protocol returns raw HTML."""
import os
import platform
from urllib.parse import urlsplit, unquote

BROWSER_VERSION = "158.0.1-beta.41"
PACKAGE_VERSION = "0.5.9"


def create_backend():
    from camoufox.async_api import AsyncCamoufox
    options = {"headless": True}
    executable = os.environ.get("CAMOUFOX_EXECUTABLE_PATH")
    if executable:
        options["executable_path"] = executable
        if platform.system() == "Windows":
            options["os"] = "windows"
    else:
        options["browser"] = "official/" + BROWSER_VERSION
    if os.environ.get("BROWSER_PROXY_URL"):
        proxy = urlsplit(os.environ["BROWSER_PROXY_URL"])
        if proxy.scheme not in ("http", "https", "socks5") or not proxy.hostname or not proxy.port:
            raise ValueError("Invalid browser proxy configuration")
        options["proxy"] = {"server": f"{proxy.scheme}://{proxy.hostname}:{proxy.port}"}
        if proxy.username:
            options["proxy"].update(username=unquote(proxy.username), password=unquote(proxy.password or ""))
    return AsyncCamoufox(**options)
