"""Build two original counting-song demos with an explicitly synthetic voice.

Requires espeak-ng, ffmpeg and pyworld==0.3.5 (plus NumPy/SciPy). Melody and
lyrics are authored for this demo; no third-party recording is downloaded.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import tempfile
import numpy as np
import pyworld as world
from scipy.io import wavfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/companion/audio'
RATE=22050
BEAT=.48
TRACKS=[
    {'id':'count-zh','title':'皮皮数数歌','locale':'zh-CN','voice':'cmn',
     'lines':[['一','二','三','四','五'],['小','小','翅','膀','轻','轻','舞'],['六','七','八','九','十'],['天','天','学','会','新','知','识']]},
    {'id':'count-en','title':'Count with Pipi','locale':'en','voice':'en-us',
     'lines':[['One','two','three','count','with','me'],['Four','five','six','clap','with','me'],['Seven','eight','nine','and','ten'],['We','can','count','and','sing','again']]},
]
MELODY=[[60,62,64,67,64,62,60],[64,65,67,69,67,64,62],[67,69,67,64,62,60,62],[64,62,60,62,64,62,60]]


def note_voice(text, voice, midi, duration, tmp):
    path=tmp/'voice.wav'
    subprocess.run(['espeak-ng','-v',voice,'-s','135','-p','62','-a','135','-w',str(path),text],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    rate,data=wavfile.read(path);assert rate==RATE
    x=np.ascontiguousarray(data.astype(np.float64)/32768)
    nz=np.where(np.abs(x)>.008)[0]
    if len(nz): x=x[max(0,nz[0]-160):min(len(x),nz[-1]+200)]
    x=np.pad(x,(256,256))
    f0,t=world.dio(x,RATE,frame_period=5,f0_floor=60,f0_ceil=800)
    f0=world.stonemask(x,f0,t,RATE)
    sp=world.cheaptrick(x,f0,t,RATE)
    ap=world.d4c(x,f0,t,RATE)
    # Keep articulation; stretch spectral envelopes to one note and give only
    # voiced phonemes the score pitch. Unvoiced consonants remain unvoiced.
    length=round(duration/.005)
    indices=np.linspace(0,len(f0)-1,length)
    lower=np.floor(indices).astype(int);upper=np.minimum(lower+1,len(f0)-1);mix=indices-lower
    spectrum=np.ascontiguousarray(sp[lower]*(1-mix[:,None])+sp[upper]*mix[:,None])
    noise=np.ascontiguousarray(ap[lower]*(1-mix[:,None])+ap[upper]*mix[:,None])
    pitch=np.where(f0[np.round(indices).astype(int)]>0,440*2**((midi-69)/12),0).astype(np.float64)
    y=world.synthesize(pitch,spectrum,noise,RATE,5)
    size=round(duration*RATE);y=np.pad(y,(0,max(0,size-len(y))))[:size]
    fade=min(180,size//8);y[:fade]*=np.linspace(0,1,fade);y[-fade:]*=np.linspace(1,0,fade)
    return y


def main():
    OUT.mkdir(exist_ok=True)
    catalog={'version':1,'voice':'Synthetic eSpeak NG + WORLD singing; not a human recording','tracks':[]}
    with tempfile.TemporaryDirectory(prefix='pipi-song-') as directory:
        tmp=Path(directory)
        for track in TRACKS:
            chunks=[np.zeros(round(BEAT*RATE))];lyrics=[];at=BEAT
            for row,line in enumerate(track['lines']):
                for n,word in enumerate(line):
                    duration=BEAT*(1.6 if n==len(line)-1 else 1)
                    midi=MELODY[row][n%len(MELODY[row])]+12
                    vocal=note_voice(word,track['voice'],midi,duration*.92,tmp)
                    note=np.zeros(round(duration*RATE));note[:len(vocal)]+=vocal*.8
                    t=np.arange(len(note))/RATE;freq=440*2**((midi-24-69)/12)
                    note+=.06*np.sin(2*np.pi*freq*t)*np.exp(-t*7)+.02*np.sin(2*np.pi*freq*2*t)*np.exp(-t*12)
                    chunks.append(note);lyrics.append({'text':word,'atMs':round(at*1000),'durationMs':round(duration*1000),'midi':midi});at+=duration
                chunks.append(np.zeros(round(BEAT*.5*RATE)));at+=BEAT*.5
            audio=np.concatenate(chunks+[np.zeros(round(BEAT*RATE))]);audio*=.88/max(.88,np.max(np.abs(audio)))
            wavfile.write(tmp/'song.wav',RATE,(audio*32767).astype(np.int16))
            destination=OUT/(track['id']+'.mp3')
            subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(tmp/'song.wav'),'-codec:a','libmp3lame','-b:a','96k',str(destination)],check=True)
            catalog['tracks'].append({'id':track['id'],'title':track['title'],'locale':track['locale'],'audioURL':'audio/'+destination.name,'gesture':'talk',
               'lyrics':' / '.join(''.join(line) if track['locale']=='zh-CN' else ' '.join(line) for line in track['lines']),
               'durationMs':round(len(audio)/RATE*1000),'syllables':lyrics,'sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),'bytes':destination.stat().st_size})
            print(track['id'],round(len(audio)/RATE,2),'seconds',flush=True)
    (OUT/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
