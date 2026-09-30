#!/usr/bin/env python3
"""유리 도구 시트(초록 배경 위, 원본 알파 있음) → 칸별 투명 WebP. 초록 정도만큼 투명하게 해서 안이 비쳐 보이는 유리로 만든다.
   python3 scripts/cutout_glass.py <시트.png> <열> <행> <출력폴더> <긴변px> <이름...>"""
import sys
from PIL import Image, ImageFilter

src, cols, rows, out, px = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], int(sys.argv[5])
names = sys.argv[6:]
im = Image.open(src).convert('RGBA'); W, H = im.size; p = im.load()
obj = im.getchannel('A').point(lambda v: 255 if v >= 200 else 0).filter(ImageFilter.GaussianBlur(1.0)).point(lambda v: 255 if v >= 150 else 0).filter(ImageFilter.GaussianBlur(0.7))
core = obj.filter(ImageFilter.MinFilter(21)).filter(ImageFilter.GaussianBlur(3))  # 유리 안쪽(벽에서 떨어진 곳)
c_ = core.load()
o = obj.load()
res = Image.new('RGBA', (W, H)); rp = res.load()
for y in range(H):
    for x in range(W):
        r, g, b, a = p[x, y]
        m = o[x, y]
        if m == 0: rp[x, y] = (0, 0, 0, 0); continue
        green = max(0.0, min(1.0, (g - max(r, b) - 4) / 34.0))
        alpha = int(m * (1 - green * 0.97) * (1 - 0.88 * c_[x, y] / 255))
        # 초록 번짐 제거: 남는 픽셀의 초록을 중립으로
        gg = min(g, max(r, b) + 4)
        rp[x, y] = (r, gg, b, alpha)
cw, ch = W // cols, H // rows
for i, n in enumerate(names):
    if n == '-': continue
    r_, c = divmod(i, cols)
    cell = res.crop((c * cw, r_ * ch, (c + 1) * cw, (r_ + 1) * ch))
    bb = cell.getchannel('A').point(lambda v: 255 if v > 90 else 0).getbbox()
    cell = cell.crop(bb); s = px / max(cell.size)
    cell = cell.resize((round(cell.size[0] * s), round(cell.size[1] * s)), Image.LANCZOS)
    cell.save(f'{out}/{n}.webp', quality=92); print(n, cell.size)

# 유리 안쪽 모양(행마다 왼쪽·오른쪽 끝, 0~1) → game/glassShapes.json. 액체를 clipPath로 잘라 채울 때 쓴다.
import json
shapes = {}
for i, n in enumerate(names):
    if n == '-': continue
    r_, c = divmod(i, cols)
    cell = obj.crop((c * cw, r_ * ch, (c + 1) * cw, (r_ + 1) * ch))
    full = res.crop((c * cw, r_ * ch, (c + 1) * cw, (r_ + 1) * ch))
    bb = full.getchannel('A').point(lambda v: 255 if v > 90 else 0).getbbox()
    cell = cell.crop(bb).point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.MinFilter(9))
    W2, H2 = cell.size; cp = cell.load()
    rows_ = []
    N = 70
    for k in range(N + 1):
        y = min(H2 - 1, int(k / N * (H2 - 1)))
        xs = [x for x in range(W2) if cp[x, y] > 128]
        if xs: rows_.append([round(y / H2, 4), round(min(xs) / W2, 4), round((max(xs) + 1) / W2, 4)])
    shapes[n] = rows_
json.dump(shapes, open('game/glassShapes.json', 'w'))
print('shapes', len(shapes))
