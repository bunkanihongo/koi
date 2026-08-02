#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
koi TTS 生成: 为 readings/*.json 每段落生成 audio/<slug>/pN.mp3
- edge-tts (ja-JP-NanamiNeural)
- 慢速: 并发 2, 失败重试
- 断点续跑: 已有 mp3 跳过
用法: python3 scripts/gen_tts.py [--limit N] [--offset M]
"""
import json, os, sys, time, subprocess, glob, concurrent.futures

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE = 'ja-JP-NanamiNeural'

def gen_one(args):
    slug, pidx, text = args
    outdir = os.path.join(BASE, 'assets/audio', slug)
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, f'p{pidx}.mp3')
    if os.path.exists(out) and os.path.getsize(out) > 500:
        return (slug, pidx, 'skip')
    # 写入临时文件
    tmp = f'/tmp/tts_{slug}_{pidx}.txt'
    with open(tmp, 'w') as f:
        f.write(text)
    for attempt in range(3):
        try:
            r = subprocess.run(['edge-tts', '--voice', VOICE, '--file', tmp, '--write-media', out],
                               capture_output=True, timeout=60)
            if os.path.exists(out) and os.path.getsize(out) > 500:
                os.remove(tmp)
                return (slug, pidx, 'ok')
        except Exception:
            pass
        time.sleep(5 * (attempt + 1))
    return (slug, pidx, 'FAIL')

def main():
    args = sys.argv[1:]
    limit = None; offset = 0
    if '--limit' in args: limit = int(args[args.index('--limit')+1])
    if '--offset' in args: offset = int(args[args.index('--offset')+1])

    rd = os.path.join(BASE, 'assets/readings')
    files = sorted(f for f in os.listdir(rd) if f.startswith('story-') and f.endswith('.json'))
    files = files[offset:]
    if limit: files = files[:limit]

    jobs = []
    for fname in files:
        slug = fname[:-5]
        d = json.load(open(os.path.join(rd, fname)))
        for pi, p in enumerate(d['paragraphs'], 1):
            jobs.append((slug, pi, p['ja']))
    print(f"待生成音频: {len(jobs)} 段")

    done = 0; fail = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
        for res in ex.map(gen_one, jobs):
            slug, pidx, status = res
            if status == 'ok': done += 1
            elif status == 'FAIL': fail.append(f"{slug}/p{pidx}")
            if (done + len(fail)) % 50 == 0:
                print(f"  进度 {done} ok / {len(fail)} fail")
            time.sleep(0.3)  # 限速

    print(f"\n完成: {done} ok, 失败 {len(fail)}")
    if fail: print('失败:', fail[:10])

if __name__ == '__main__':
    main()
