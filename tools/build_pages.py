# -*- coding: utf-8 -*-
"""src/scanner.html（Artifact 版）から GitHub Pages 用の index.html を作る。

  python tools/build_pages.py            … リポジトリ直下の index.html を書き換える
  python tools/build_pages.py --check    … 書き換えずに、今の index.html と一致するかだけ確認

Artifact 版は公開時に <!doctype html><head>…<body> が自動で付く前提で書いてある。
ここでは、その head にホーム画面アプリ用の meta・アイコン・manifest を足す。
"""
import hashlib, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "scanner.html")
OUT = os.path.join(ROOT, "index.html")

THEME = "#0E7458"
PWA = """<meta name="theme-color" content="{theme}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="{name}">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" href="apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
"""


def build():
    src = open(SRC, encoding="utf-8", newline="").read()
    i = src.index("<style>")                     # ここまでが head に入る部分
    head, body = src[:i], src[i:]
    lines = [l for l in head.splitlines(keepends=True) if 'name="claude:' not in l]
    title = re.search(r"<title>(.*?)</title>", head).group(1)
    out = ["<!doctype html>\n<html lang=\"ja\">\n<head>\n<meta charset=\"utf-8\">\n",
           "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n"]
    for l in lines:
        out.append(l)
        if l.startswith("<title>"):
            out.append(PWA.format(theme=THEME, name=title))
    out.append("</head>\n<body>\n")
    out.append(body.rstrip("\n") + "\n</body>\n</html>\n")
    return "".join(out)


if __name__ == "__main__":
    html = build().encode("utf-8")
    h = hashlib.sha256(html).hexdigest()
    if "--check" in sys.argv:
        cur = hashlib.sha256(open(OUT, "rb").read()).hexdigest()
        print(("一致" if cur == h else "不一致"), "生成", h[:8], "現在", cur[:8])
        sys.exit(0 if cur == h else 1)
    open(OUT, "wb").write(html)
    print("index.html を作成", len(html), "bytes", h[:8])
