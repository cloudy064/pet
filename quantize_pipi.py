"""Perceptual palette allocation for small packaged PNG derivatives.

Full-color masters stay unchanged. No temporal dithering is introduced, so
held body/wing pixels cannot shimmer between frames.
"""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent/'.tools/imagequant'))
from imagequant import quantize_pil_image

def palette(image):
    result=quantize_pil_image(image.convert('RGBA'),dithering_level=0,max_colors=256,min_quality=0,max_quality=100)
    colors=result.getpalette('RGBA')
    for i in range(0,len(colors),4):
        if colors[i+3]==0:colors[i:i+3]=[0,0,0]
    result.putpalette(colors,rawmode='RGBA')
    return result
