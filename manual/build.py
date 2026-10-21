# -*- coding: utf-8 -*-
"""使用手順書：manual.md → manual.html（図は img/ から data: URI で埋め込む）。
  python manual/build.py        → manual/manual.html
  node manual/pdf.js            → manual/SCANNER_使用手順書.pdf（Playwright が必要）
[[FIG a.png|説明;;b.png|説明]] を図の横並びに変換する。1枚だけのときは .shots.one（幅 60%）。
"""
import base64, os, re
import markdown  # pip install markdown

D = os.path.dirname(os.path.abspath(__file__))
md = open(os.path.join(D, "manual.md"), encoding="utf-8").read()


def fig(m):
    out = []
    for item in m.group(1).split(";;"):
        f, cap = item.split("|", 1)
        b = base64.b64encode(open(os.path.join(D, "img", f), "rb").read()).decode()
        out.append(f'<figure><img src="data:image/png;base64,{b}"><figcaption>{cap}</figcaption></figure>')
    return '\n<div class="shots' + (" one" if len(out) == 1 else "") + '">' + "".join(out) + "</div>\n"


md = re.sub(r"\[\[FIG (.+?)\]\]", fig, md)
body = markdown.markdown(md, extensions=["tables", "sane_lists"])
css = open(os.path.join(D, "style.css"), encoding="utf-8").read()
html = f'<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>SCANNER 使用手順書</title><style>{css}</style></head><body>{body}</body></html>'
open(os.path.join(D, "manual.html"), "w", encoding="utf-8").write(html)
print("manual.html を作成")
