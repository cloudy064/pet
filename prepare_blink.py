"""Remove connected neutral checkerboard; retain original character RGB pixels.
Run: python prepare_blink.py (Pillow required).
"""
from collections import deque
from pathlib import Path
import json
from PIL import Image, ImageFilter

root = Path(__file__).resolve().parent
source = Image.open(root / 'assets/pipi-blink-strip-draft.png').convert('RGB')
w, h = source.size
pixels = source.load()
visited = bytearray(w*h)
queue = deque()

def visit(x, y):
    index = y*w+x
    if visited[index]:
        return
    r,g,b = pixels[x,y]
    if max(r,g,b)-min(r,g,b) <= 40:
        visited[index] = 1
        queue.append((x,y))

for x in range(w):
    visit(x,0)
    visit(x,h-1)
for y in range(h):
    visit(0,y)
    visit(w-1,y)
while queue:
    x,y = queue.popleft()
    if x: visit(x-1,y)
    if x+1<w: visit(x+1,y)
    if y: visit(x,y-1)
    if y+1<h: visit(x,y+1)

alpha = Image.frombytes('L',(w,h),bytes(0 if v else 255 for v in visited))
# One-pixel choke removes checkerboard contamination at antialiased edges.
alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.45))
source.putalpha(alpha)
source.save(root/'assets/pipi-blink-strip.png')
cell=w//6
bounds=[]
for i in range(6):
    bounds.append(alpha.crop((i*cell,0,(i+1)*cell,h)).getbbox())
metadata={'version':3,'id':'blink','image':'pipi-blink-strip.png','frameWidth':cell,
          'frameHeight':h,'columns':6,'frameCount':6,'fps':12,'loop':True,
          'frames':[{'x':i*cell,'y':0,'w':cell,'h':h} for i in range(6)],
          'notes':'Original generated RGB preserved; connected checkerboard removed with alpha mask.'}
(root/'assets/pipi-blink-strip.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
preview=Image.new('RGBA',source.size,'#243b39')
preview.alpha_composite(source)
preview.convert('RGB').save(root/'assets/pipi-blink-dark-check.jpg')
print(json.dumps({'size':source.size,'mode':source.mode,'alpha':alpha.getextrema(),
                  'transparentPixels':alpha.histogram()[0],'frameBounds':bounds}))
