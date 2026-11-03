#!/usr/bin/env python3
"""倭姫命世記「全文」タブのデータを作る。

  倭姫命世記/kakutei/page_NN.md   （確定翻刻）
  倭姫命世記/gendaigo/page_NN.md  （現代語訳）
を読み、ビューアーが読む 倭姫命世記/zenbun-data.js を書き出す。

使い方（リポジトリ直下で）:
    python3 tools/build-zenbun.py

訳や翻刻の Markdown を直したら、これを実行し直して zenbun-data.js をコミットする。
ブラウザは Markdown を読まない（zenbun-data.js だけを読む）。

翻刻の表記（kakutei の「## 右丁」「## 左丁」の中）:
  N: 本文            原本の第 N 行
  〈朱〉…〈/朱〉      朱書（頭注・割注の中では 〈/朱〉 を省いてもよい。閉じ括弧までが朱）
  〔注：…〕          割注・細字・傍記（「／」で二行に割る）
  〔朱枠：…〕        朱の枠囲み（行をまたいでよい）
  【頭注…】          頭注（行頭に置くか、独立した一行として置く）
  ［？］ ［某？］     判読不能／候補のある字
  （…）              行番号のない説明（白紙など）
"""

import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOK = ROOT / "倭姫命世記"
KAKUTEI = BOOK / "kakutei"
GENDAIGO = BOOK / "gendaigo"
OUT = BOOK / "zenbun-data.js"
TOTAL = 45


def esc(s):
    return html.escape(s, quote=True)


def sections(text):
    """'## 見出し' ごとに本文の行を分ける。"""
    out, name = {}, None
    for line in text.splitlines():
        if line.startswith("## "):
            name = line[3:].strip()
            out[name] = []
        elif line.startswith("# "):
            continue
        elif name is not None:
            out[name].append(line)
    for k in out:
        while out[k] and not out[k][-1].strip():
            out[k].pop()
        while out[k] and not out[k][0].strip():
            out[k].pop(0)
    return out


# ── 翻刻の行を HTML にする ─────────────────────────────

OPEN_TAG = {
    "shu": '<span class="z-shu">',
    "chu": '<span class="z-chu"><span class="z-chu-l">',
    "waku": '<span class="z-waku">',
    "tochu": '<span class="z-tochu" title="頭注">',
}
CLOSE_TAG = {
    "shu": "</span>",
    "chu": "</span></span>",
    "waku": "</span>",
    "tochu": "</span>",
}


class Honkoku:
    """翻刻の一丁分。〔朱枠：…〕のように行をまたぐ囲みがあるので、開いた囲みを次の行へ持ち越す。"""

    def __init__(self):
        self.stack = []  # 開いている囲み（外側から）

    def line(self, src):
        out = [OPEN_TAG[k] for k in self.stack]  # 前の行から続く囲みを開き直す
        i, n = 0, len(src)
        while i < n:
            rest = src[i:]
            if rest.startswith("〈朱〉"):
                self._open(out, "shu"); i += 3; continue
            if rest.startswith("〈/朱〉"):
                self._close_to(out, ("shu",)); i += 4; continue
            if rest.startswith("〔注："):
                self._open(out, "chu"); i += 3; continue
            if rest.startswith("〔朱枠："):
                self._open(out, "waku"); i += 4; continue
            if rest.startswith("【頭注"):
                self._open(out, "tochu"); i += 3
                if i < n and src[i] in " 　":
                    i += 1
                # 「【頭注〈朱〉…】」のように 〈/朱〉 を省いた朱の頭注は、】までを朱とする
                continue
            c = src[i]
            if c == "〕" and any(k in ("chu", "waku") for k in self.stack):
                self._close_to(out, ("chu", "waku")); i += 1; continue
            if c == "】" and "tochu" in self.stack:
                self._close_to(out, ("tochu",)); i += 1; continue
            if c == "／" and "chu" in self.stack:
                # 割注を二行に割る：chu の内側を閉じて新しい行を開き、内側を開き直す
                idx = len(self.stack) - 1 - self.stack[::-1].index("chu")
                inner = self.stack[idx + 1:]
                for k in reversed(inner):
                    out.append(CLOSE_TAG[k])
                out.append('</span><span class="z-chu-l">')
                for k in inner:
                    out.append(OPEN_TAG[k])
                i += 1
                continue
            if c == "［":
                j = src.find("］", i)
                if j > i:
                    body = src[i + 1:j]
                    guess = body.rstrip("？?")
                    title = "判読不能" if not guess else "判読不確か（候補：" + guess + "）"
                    cls = "z-unk" if not guess else "z-unk z-guess"
                    out.append('<span class="%s" title="%s">［%s］</span>' % (cls, esc(title), esc(body)))
                    i = j + 1
                    continue
            out.append(esc(c))
            i += 1
        # 行末：開いている囲みをいったん閉じる（次の行で開き直す）
        for k in reversed(self.stack):
            out.append(CLOSE_TAG[k])
        return "".join(out)

    def _open(self, out, kind):
        self.stack.append(kind)
        out.append(OPEN_TAG[kind])

    def _close_to(self, out, kinds):
        while self.stack:
            k = self.stack.pop()
            out.append(CLOSE_TAG[k])
            if k in kinds:
                return


NOTE_SCALE = 0.6  # 割注の字の大きさ（zenbun.css の .z-chu と合わせる）


def visual_length(src):
    """縦書きの一行の長さ（本文の字の数）の目安。割注は小さく、「／」で割った長い方で数える。頭注は数えない。"""
    s = re.sub(r"【[^】]*】", "", src)
    s = re.sub(r"〈/?朱〉|〔朱枠：", "", s)

    def walk(i, scale):
        # i から読み、閉じ（〕）か行末までの長さを返す。割注の中の「／」で列を改める
        cols, cur = [], 0.0
        while i < len(s):
            if s.startswith("〔注：", i):
                ln, i = walk(i + 3, NOTE_SCALE)
                cur += ln
                continue
            c = s[i]
            i += 1
            if c == "〕":
                break
            if c == "／" and scale < 1:
                cols.append(cur); cur = 0.0
                continue
            if c == "［":  # ［某？］は括弧ごと表示するので、その字数で数える
                j = s.find("］", i)
                if j >= 0:
                    cur += (j - i + 2) * scale
                    i = j + 1
                    continue
            cur += scale
        cols.append(cur)
        return max(cols), i

    return walk(0, 1.0)[0]


def build_side(lines, hk):
    """右丁・左丁の行を列の一覧にする。"""
    cols, maxlen = [], 0.0
    for raw in lines:
        if not raw.strip():
            continue
        m = re.match(r"^(\d+):\s?(.*)$", raw)
        if m:
            no, body = int(m.group(1)), m.group(2)
            head = None
            hm = re.match(r"^(【頭注[^】]*】)(.*)$", body)
            if hm:  # 行頭の頭注は、その行の上欄に置く
                head, body = hm.group(1), hm.group(2)
            col = {"no": no, "html": hk.line(body)}
            if head:
                col["head"] = hk.line(head)
            cols.append(col)
            maxlen = max(maxlen, visual_length(body))
        elif raw.lstrip().startswith("【頭注"):
            cols.append({"head": hk.line(raw.strip())})
        else:
            cols.append({"blank": esc(raw.strip())})
    return cols, maxlen


# ── 注・訳の Markdown（ごく一部だけ）を HTML にする ─────────────

def inline_md(s):
    s = esc(s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    return s


def honkoku_inline(s):
    """注の中に出る翻刻の表記にも色を付ける（〈朱〉…〈/朱〉、［？］）。閉じのない 〈朱〉 はそのまま残す。"""
    s = inline_md(s)
    s = re.sub(r"〈朱〉(.*?)〈/朱〉", r'<span class="z-shu">\1</span>', s)
    s = re.sub(r"［([^］]*)］", r'<span class="z-unk">［\1］</span>', s)
    return s


def md_list(lines, inline=inline_md):
    """'- ' と '  - ' の二段までの箇条書き。箇条でない行は段落にする。"""
    out, depth = [], 0
    for raw in lines:
        if not raw.strip():
            continue
        m = re.match(r"^(\s*)- (.*)$", raw)
        if not m:
            out.append("</li></ul>" * depth)
            depth = 0
            out.append("<p>%s</p>" % inline(raw.strip()))
            continue
        level = 1 if len(m.group(1)) < 2 else 2
        if level > depth:
            out.append("<ul><li>" * (level - depth))
        else:
            out.append("</li></ul>" * (depth - level) + "</li><li>")
        depth = level
        out.append(inline(m.group(2)))
    out.append("</li></ul>" * depth)
    return "".join(out)


def yaku_inline(s):
    s = inline_md(s)
    # 《傍記：…》《割注：…》《異本注記：…》《細字注：…》など、原本の小字の書き入れ
    s = re.sub(r"《([^：》]{1,8})：(.*?)》",
               lambda m: '<span class="z-y-small" data-kind="%s">%s</span>' % (m.group(1), m.group(2)), s)
    # 〔1〕 注番号
    s = re.sub(r"〔(\d+)〕", r'<sup class="z-ref">\1</sup>', s)
    # 〔…〕 訳者の補い
    s = re.sub(r"〔([^〔〕]*)〕", r'<span class="z-hokan">〔\1〕</span>', s)
    return s


def yaku_body(lines):
    out = []
    for raw in lines:
        t = raw.strip()
        if not t:
            continue
        if t == "【左丁】" or t == "【右丁】":
            out.append('<p class="z-y-side">%s</p>' % esc(t[1:-1]))
        else:
            h = yaku_inline(t)
            # 見出しのない 《…》 も、訳の本文では原本の小字（割注など）として小さく組む
            h = re.sub(r"《([^《》]*)》", r'<span class="z-y-small">\1</span>', h)
            out.append("<p>%s</p>" % h)
    return "".join(out)


def main():
    pages, problems = [], []
    for n in range(TOTAL):
        nn = "%02d" % n
        kf, gf = KAKUTEI / ("page_%s.md" % nn), GENDAIGO / ("page_%s.md" % nn)
        page = {"n": n}
        if kf.exists():
            sec = sections(kf.read_text(encoding="utf-8"))
            hk = Honkoku()
            migi, l1 = build_side(sec.get("右丁", []), hk)
            hidari, l2 = build_side(sec.get("左丁", []), hk)
            if hk.stack:
                problems.append("%s: 閉じていない囲み %s" % (kf.name, hk.stack))
            notes = sec.get("注", [])
            naiyou = sec.get("この丁の内容", [])
            status = ""
            if naiyou and naiyou[-1].strip() in ("突き合わせ済み",):
                status = naiyou.pop().strip()
                while naiyou and not naiyou[-1].strip():
                    naiyou.pop()
            page["honkoku"] = {
                "migi": migi,
                "hidari": hidari,
                "len": max(l1, l2, 8),
                "notes": md_list(notes, honkoku_inline),
                "naiyou": inline_md(" ".join(x.strip() for x in naiyou if x.strip())),
                "status": status,
            }
        else:
            problems.append("翻刻がない: " + kf.name)
        if gf.exists():
            sec = sections(gf.read_text(encoding="utf-8"))
            head = [x for x in sec.get("頭注・朱書", []) if x.strip()]
            if len(head) == 1 and re.fullmatch(r"[（(]?なし[）)]?.*", head[0].lstrip("- ").strip()) and not head[0].lstrip("- ").startswith("なし（"):
                head = []
            page["yaku"] = {
                "body": yaku_body(sec.get("現代語訳", [])),
                "head": md_list(head, yaku_inline),
                "notes": md_list(sec.get("注", []), yaku_inline),
                "source": " ".join(x.strip() for x in sec.get("底本", []) if x.strip()),
            }
        else:
            problems.append("訳がない: " + gf.name)
        pages.append(page)

    data = {
        "total": TOTAL,
        "pages": pages,
    }
    # 一丁を一行にする（作り直したときの差分が丁ごとに見えるように）
    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    js = ("// このファイルは tools/build-zenbun.py が作る。手で直さないこと。\n"
          "// 元：倭姫命世記/kakutei/page_NN.md（確定翻刻）・倭姫命世記/gendaigo/page_NN.md（現代語訳）\n"
          "window.ZENBUN_DATA = {\n"
          "\"total\":" + dump(TOTAL) + ",\n"
          "\"pages\":[\n" + ",\n".join(dump(pg) for pg in pages) + "\n]};\n")
    OUT.write_text(js, encoding="utf-8")
    print("書き出し: %s（%d 丁、%d KB）" % (OUT.relative_to(ROOT), len(pages), len(js.encode()) // 1024))
    for p in problems:
        print("注意: " + p, file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
