#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
koi AI 填充: 为 readings/*.json 生成 en/literal/grammar
- 用 DeepSeek API (openai-completions)
- 慢速: 每条请求间隔 ~2s, 失败退避重试
- 断点续跑: 已有 en 的段落跳过
用法: python3 scripts/fill_ai.py [--limit N] [--offset M]
"""
import json, os, re, sys, time, urllib.request

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API_KEY = os.environ.get('DEEPSEEK_API_KEY', 'sk-413c' + 'xxxx')  # placeholder
API_URL = 'https://api.deepseek.com/chat/completions'

# 从 hermes .env 读 key
def load_key():
    try:
        for line in open('/home/horse/.hermes/.env'):
            if line.startswith('DEEPSEEK_API_KEY='):
                return line.strip().split('=', 1)[1].strip('"').strip("'")
    except Exception:
        pass
    return None

def call_llm(prompt, max_tokens=2000, retries=3):
    body = json.dumps({
        'model': 'deepseek-chat',
        'messages': [{'role': 'user', 'content': prompt}],
        'max_tokens': max_tokens,
        'temperature': 0.3
    }).encode()
    req = urllib.request.Request(API_URL, data=body, headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
    })
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                d = json.loads(resp.read())
                return d['choices'][0]['message']['content']
        except Exception as e:
            if attempt == retries - 1:
                return None
            time.sleep(10 * (attempt + 1))
    return None

PROMPT_TEMPLATE = """あなたは日本語教師です。以下の日本語の実話（恋に落ちた話）を、日本語学習者向けに翻訳・解説してください。

出力は必ず以下の JSON 形式で（マークダウンなし、コードブロックなし）:
```json
{{"paragraphs": [{{"en": "英語訳", "literal": "中国語（简体中文）による直訳。例: 日本語「私は学生です」→ 中文「我是学生」。絶対に中国語で書き、日本語やローマ字を使わないこと。", "grammar": "文法解説（日本語で、1-3個の文型を「〜」形式で説明）"}}]}}
```

対象テキスト（段落ごと）:
{paras}

注意:
- en は自然な英語訳
- literal は必ず简体中文（中国語）で書く。日本語の語順に沿った逐語訳。絶対に日本語を使わない。
- grammar は日本語で簡潔に
"""

def main():
    args = sys.argv[1:]
    limit = None; offset = 0
    if '--limit' in args: limit = int(args[args.index('--limit')+1])
    if '--offset' in args: offset = int(args[args.index('--offset')+1])

    global API_KEY
    k = load_key()
    if k: API_KEY = k
    if API_KEY.endswith('xxxx'):
        print('ERROR: API key not found'); sys.exit(1)

    rd = os.path.join(BASE, 'assets/readings')
    files = sorted(f for f in os.listdir(rd) if f.startswith('story-') and f.endswith('.json'))
    files = files[offset:]
    if limit: files = files[:limit]
    print(f"待处理: {len(files)} 篇")

    done = 0; skipped = 0; failed = []
    for fi, fname in enumerate(files):
        path = os.path.join(rd, fname)
        d = json.load(open(path))
        paras = d['paragraphs']
        need = [p for p in paras if not p.get('en')]
        if not need:
            skipped += 1
            continue

        # 段落文本列表
        texts = [p['ja'] for p in need]
        prompt = PROMPT_TEMPLATE.format(paras=json.dumps(texts, ensure_ascii=False))
        resp = call_llm(prompt)
        if not resp:
            failed.append(fname)
            print(f"[{fi}] {fname}: API 失败")
            time.sleep(30)
            continue

        # 解析 JSON（容忍代码块）
        resp = re.sub(r'^```(?:json)?\s*|\s*```$', '', resp.strip())
        try:
            data = json.loads(resp)
            filled = data['paragraphs']
            for p, f in zip(need, filled):
                p['en'] = f.get('en', '')
                p['literal'] = f.get('literal', '')
                p['grammar'] = f.get('grammar', '')
            json.dump(d, open(path, 'w'), ensure_ascii=False, indent=1)
            done += 1
        except Exception as e:
            failed.append(fname)
            print(f"[{fi}] {fname}: JSON 解析失败: {e}")

        if done % 10 == 0:
            print(f"  进度 {done}/{len(files)} (跳过{skipped})")
        time.sleep(2)  # 慢速，避免限流

    print(f"\n完成: 填充 {done}, 跳过 {skipped}, 失败 {len(failed)}")
    if failed:
        print("失败文件:", failed[:10])

if __name__ == '__main__':
    main()
