#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
koi 生成管线: 450 条恋爱故事 → takanote 读解格式
步骤:
  1. 从 classified_538.json 读 S 类故事
  2. 清洗文本 (去 URL/@提及/换行, 截断到合理长度)
  3. Sudachi 分词注音 (words)
  4. 生成 vocab (自动提取难词 + 假名)
  5. 输出 assets/readings/<slug>.json + _posts/<date>-<slug>.md
  6. 更新 reading-room.js 的 READING_LIST
用法: python3 scripts/gen_site.py [--limit N] [--offset M] [--only-readings]
"""
import json, os, re, sys, unicodedata, html

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = '/home/horse/.openclaw/workspace/x-stories/quotes/classified_538.json'

# ---- Sudachi ----
from sudachipy import tokenizer, dictionary
tok = dictionary.Dictionary().create()
mode = tokenizer.Tokenizer.SplitMode.C

def kata_to_hira(s):
    r = []
    for ch in s:
        if 'カ' <= ch <= 'ン': r.append(chr(ord(ch) - ord('カ') + ord('か')))
        elif 'ア' <= ch <= 'オ': r.append(chr(ord(ch) - ord('ア') + ord('あ')))
        elif ch == 'ヴ': r.append('ゔ')
        else: r.append(ch)
    return ''.join(r)

def map_pos(pos_parts):
    if not pos_parts: return ''
    return {'名詞':'noun','動詞':'verb','助詞':'particle','形容詞':'adj','連体詞':'adj',
            '副詞':'adverb','接続詞':'connector','接頭辞':'connector','接尾辞':'connector',
            '助動詞':'grammar','記号':'symbol','代名詞':'noun','数詞':'noun','感動詞':'interjection'}.get(pos_parts[0], '')

def tokenize_text(text):
    words = []
    for t in tok.tokenize(text, mode):
        p = t.part_of_speech()
        r = t.reading_form() or ''
        # 动词/形容词用原形读音更规范
        if p[0] in ('動詞', '形容詞'):
            lf = t.dictionary_form()
            if lf != '*':
                lf_t = tok.tokenize(lf, mode)[0]
                r = lf_t.reading_form() or r
        if r: r = kata_to_hira(r)
        words.append({
            's': t.dictionary_form() if t.dictionary_form() != '*' else t.surface(),
            'r': r if r and r != t.surface() else '',
            'p': map_pos(p)
        })
    return words

# ---- 清洗 ----
URL_RE = re.compile(r'https?://\S+|t\.co/\S+')
AT_RE = re.compile(r'@\w+')
def clean_text(t):
    t = URL_RE.sub('', t)
    t = AT_RE.sub('', t)
    t = t.replace('⏎', '。').replace('\n', '。')
    t = re.sub(r'[。・]+', '。', t)
    t = re.sub(r'\s+', ' ', t)
    # 去掉可能截断的残留 emoji/符号（保留基础日文标点）
    t = re.sub(r'[\U0001F300-\U0001FAFF\u2600-\u27BF\uFE0F]', '', t)
    t = re.sub(r'^[。、\s]+|[。、\s]+$', '', t)
    return t.strip()

# ---- slug ----
def make_slug(screen, idx, text):
    # 用账号 + 序号做稳定 slug
    return f"story-{idx:03d}-{screen}"

# ---- 读已有数据 ----
def load_old():
    old = {}
    rd = os.path.join(BASE, 'assets/readings')
    if os.path.isdir(rd):
        for f in os.listdir(rd):
            if f.endswith('.json'):
                try:
                    d = json.load(open(os.path.join(rd, f)))
                    old[d['id']] = d
                except Exception:
                    pass
    return old

def main():
    args = sys.argv[1:]
    limit = None; offset = 0
    if '--limit' in args: limit = int(args[args.index('--limit')+1])
    if '--offset' in args: offset = int(args[args.index('--offset')+1])
    only_readings = '--only-readings' in args

    data = json.load(open(SRC))
    stories = [d for d in data if d['_cat'] == 'S']
    stories.sort(key=lambda d: d.get('created',''))
    print(f"总故事数: {len(stories)}")

    old = load_old()
    done = 0; skipped = 0
    readings_dir = os.path.join(BASE, 'assets/readings')
    posts_dir = os.path.join(BASE, '_posts')
    audio_dir = os.path.join(BASE, 'assets/audio')
    os.makedirs(readings_dir, exist_ok=True)
    os.makedirs(posts_dir, exist_ok=True)
    os.makedirs(audio_dir, exist_ok=True)

    entries = []  # for READING_LIST

    for i, st in enumerate(stories):
        if i < offset: continue
        if limit is not None and done >= limit: break
        idx = i + 1
        slug = make_slug(st['screen'], idx, st['text'])
        if slug in old and not only_readings:
            skipped += 1
            entries.append({'id': slug, 'title': old[slug]['title'], 'kicker': old[slug]['level'],
                            'desc': old[slug].get('subtitle',''), 'badge': old[slug]['length'],
                            'file': f"/koi/assets/readings/{slug}.json"})
            continue

        raw = st['text']
        ja = clean_text(raw)
        if len(ja) < 20:  # 太短跳过
            skipped += 1
            continue

        # 分段: 按句号切成 1-3 段
        sents = [s for s in ja.split('。') if s.strip()]
        if len(sents) > 4:
            # 每 2 句一段
            paras = []
            for k in range(0, len(sents), 2):
                chunk = '。'.join(sents[k:k+2]).strip() + '。'
                if len(chunk) > 10: paras.append(chunk)
                if len(paras) >= 3: break
        else:
            paras = [s + '。' for s in sents if s.strip()]
        if not paras: paras = [ja + '。']
        paras = paras[:3]

        # 标题: 取前 20 字
        title = ja[:22] + ('…' if len(ja) > 22 else '')
        subtitle = f"@ {st['screen']} の実体験 — 日本語読解"
        date = st['created'][:10]

        # 段落数据
        paragraphs = []
        for pi, para in enumerate(paras, 1):
            words = tokenize_text(para)
            # vocab: 名词/动词/形容词/副词, 有读音, 长度>=2, 去重复
            vocab_seen = set()
            vocab = []
            for w in words:
                if w['p'] in ('noun','verb','adj','adverb') and w['r'] and len(w['s']) >= 2:
                    if w['s'] in vocab_seen: continue
                    if re.match(r'^[ぁ-んァ-ヶーa-zA-Z0-9]+$', w['s']):  # 太简单跳过
                        continue
                    vocab_seen.add(w['s'])
                    vocab.append([w['s'], w['r'], ''])
                    if len(vocab) >= 8: break
            paragraphs.append({
                'id': f"p{pi}",
                'ja': para,
                'en': '',      # AI 填充
                'literal': '', # AI 填充
                'grammar': '', # AI 填充
                'vocab': vocab,
                'words': words
            })

        reading = {
            'id': slug,
            'title': title,
            'subtitle': subtitle,
            'level': '初級〜中級',
            'length': f"{len(paragraphs)}段落",
            'date': date,
            'author': st['screen'],
            'source': st.get('url',''),
            'paragraphs': paragraphs
        }
        json.dump(reading, open(os.path.join(readings_dir, slug+'.json'),'w'), ensure_ascii=False, indent=1)

        # _posts md
        if not only_readings:
            front = f"""---
title: {title}
date: {date} 12:00:00 +0900
categories: [恋愛]
tags: [実話, 読解]
---

> 📖 [読解ルームで詳細を読む](/koi/reading-room/?read={slug}) — 逐語訳・文法解説・音声練習付き

{ja}

<p class="text-muted small">出典: <a href="{st.get('url','')}">@{st['screen']} のポスト</a>（{date}）</p>
"""
            open(os.path.join(posts_dir, f"{date}-{slug}.md"), 'w').write(front)

        entries.append({'id': slug, 'title': title, 'kicker': '初級〜中級',
                        'desc': f"@{st['screen']}", 'badge': f"{len(paragraphs)}段落",
                        'file': f"/koi/assets/readings/{slug}.json"})
        done += 1
        if done % 20 == 0:
            print(f"  已生成 {done} 条 (idx {idx})")

    print(f"完成: 新生成 {done}, 跳过 {skipped}")
    # 写 READING_LIST (排序: 新→旧)
    entries.sort(key=lambda e: e['id'], reverse=True)
    out = '\n'.join(f"    {{ id: '{e['id']}', title: '{e['title']}', kicker: '{e['kicker']}', desc: '{e['desc']}', badge: '{e['badge']}', file: '{e['file']}' }}," for e in entries)
    js_path = os.path.join(BASE, 'assets/js/reading-room.js')
    js = open(js_path).read()
    js = re.sub(r'const READING_LIST = \[.*?\n  \];', 'const READING_LIST = [\n' + out + '\n  ];', js, flags=re.S)
    open(js_path, 'w').write(js)
    print(f"READING_LIST 已更新: {len(entries)} 条")

if __name__ == '__main__':
    main()
