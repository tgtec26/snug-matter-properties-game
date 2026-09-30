#!/usr/bin/env python3
"""Codex 시트(어두운/초록 번짐 배경) → 칸별 투명 WebP.
   python3 scripts/cutout_sheet.py <시트.png> <열> <행> <출력폴더> <긴변px> <이름...>
   - 가장자리에서 이어진 어두운·초록 배경을 지우고, 안쪽 초록(유리 너머)은 chroma로 지운다. 테두리 번짐은 침식으로 정리."""
import os, sys
from collections import deque
from PIL import Image, ImageFilter

src, cols, rows, out, px = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], int(sys.argv[5])
names = sys.argv[6:]
im = Image.open(src).convert('RGBA'); W, H = im.size; p = im.load()
def chroma(r, g, b): return g > r + 22 and g > b + 22
def cand(x, y):
    r, g, b, a = p[x, y]; return a == 0 or (r + g + b) / 3 < 70 or chroma(r, g, b)
seen = bytearray(W * H); q = deque()
for x in range(W):
    for y in (0, H - 1):
        if cand(x, y): q.append((x, y)); seen[y * W + x] = 1
for y in range(H):
    for x in (0, W - 1):
        if cand(x, y) and not seen[y * W + x]: q.append((x, y)); seen[y * W + x] = 1
while q:
    x, y = q.popleft()
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and cand(nx, ny): seen[ny * W + nx] = 1; q.append((nx, ny))
mask = Image.new('L', (W, H), 0); m = mask.load()
for y in range(H):
    for x in range(W):
        r, g, b, a = p[x, y]
        if not seen[y * W + x] and not chroma(r, g, b): m[x, y] = 255
E = int(os.environ.get('ERODE', '5'))  # 유리처럼 얇은 물체는 ERODE=3
mask = mask.filter(ImageFilter.MedianFilter(3 if E < 5 else 5)).filter(ImageFilter.MinFilter(E)).filter(ImageFilter.GaussianBlur(0.8))
im.putalpha(mask)
cw, ch = W // cols, H // rows
for i, n in enumerate(names):
    if n == '-': continue
    r, c = divmod(i, cols)
    cell = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
    bb = cell.getchannel('A').point(lambda v: 255 if v > 128 else 0).getbbox()
    cell = cell.crop(bb); s = px / max(cell.size)
    cell = cell.resize((round(cell.size[0] * s), round(cell.size[1] * s)), Image.LANCZOS)
    cell.save(f'{out}/{n}.webp', quality=92); print(n, cell.size)
