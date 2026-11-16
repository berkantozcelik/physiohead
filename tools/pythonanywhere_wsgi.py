"""
PythonAnywhere WSGI file for www.physiohead.org (copy of /var/www/www_physiohead_org_wsgi.py).

How the site is served:
  * /assets/...  -> PythonAnywhere static files mapping (fast). CSS and JS carry
                    ?v= version stamps (tools/stamp-assets.mjs), so they can be cached.
  * pages        -> this file. Every page is sent with "Cache-Control: no-cache",
                    so browsers always check for a newer version (a quick 304 reply
                    when nothing changed) instead of showing an old copy for days.

Only top-level pages (*.html) and a few well-known files are served here, so
private things in the project folder (.git, docs, tests, firebase rules
sources) are never published.
"""
import email.utils
import os

PROJECT_ROOT = "/home/gmpsturkiye/physiohead"
EXTRA_FILES = {"robots.txt", "sitemap.xml", "favicon.ico"}
TYPES = {
    ".html": "text/html; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".ico": "image/x-icon",
}


def not_found(start_response):
    body = b"Page not found."
    start_response("404 NOT FOUND", [
        ("Content-Type", "text/plain; charset=utf-8"),
        ("Content-Length", str(len(body))),
        ("Cache-Control", "no-cache"),
    ])
    return [body]


def application(environ, start_response):
    path = environ.get("PATH_INFO", "/")
    if path.endswith("/"):
        path += "index.html"
    name = path.lstrip("/")

    allowed = (
        "/" not in name
        and "\\" not in name
        and not name.startswith(".")
        and (name.endswith(".html") or name in EXTRA_FILES)
    )
    full_path = os.path.join(PROJECT_ROOT, name)
    if not allowed or not os.path.isfile(full_path):
        return not_found(start_response)

    stat = os.stat(full_path)
    etag = '"%x-%x"' % (int(stat.st_mtime), stat.st_size)
    headers = [
        ("Content-Type", TYPES.get(os.path.splitext(name)[1], "application/octet-stream")),
        ("Cache-Control", "no-cache"),
        ("Last-Modified", email.utils.formatdate(stat.st_mtime, usegmt=True)),
        ("ETag", etag),
    ]

    if environ.get("HTTP_IF_NONE_MATCH") == etag:
        start_response("304 NOT MODIFIED", headers)
        return [b""]

    with open(full_path, "rb") as f:
        data = f.read()
    headers.append(("Content-Length", str(len(data))))
    start_response("200 OK", headers)
    if environ.get("REQUEST_METHOD") == "HEAD":
        return [b""]
    return [data]
