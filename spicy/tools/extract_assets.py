"""Extract the web assets (HTML/JS/CSS) Tauri embeds in wizzly.exe, to check the Spicy mod still fits.

Usage: python3 extract_assets.py wizzly.exe out_dir
"""
import pefile, struct, re, brotli, os, sys
path=sys.argv[1]; out=sys.argv[2]
pe=pefile.PE(path, fast_load=True); data=open(path,'rb').read(); base=pe.OPTIONAL_HEADER.ImageBase
def off2va(o):
    for s in pe.sections:
        if s.PointerToRawData<=o<s.PointerToRawData+s.SizeOfRawData: return base+s.VirtualAddress+(o-s.PointerToRawData)
def va2off(va):
    r=va-base
    for s in pe.sections:
        if s.VirtualAddress<=r<s.VirtualAddress+s.Misc_VirtualSize: return s.PointerToRawData+(r-s.VirtualAddress)
found={}
for m in re.finditer(rb'/(?:assets/[A-Za-z0-9_.\-]+|index\.html|[a-z]+\.svg)', data):
    key=m.group(0); 
    for L in range(len(key),4,-1):
        k=key[:L]
        va=off2va(m.start())
        pat=struct.pack('<QQ',va,L)
        for mm in re.finditer(re.escape(pat), data):
            p=mm.start()
            vptr,vlen=struct.unpack('<QQ',data[p+16:p+32])
            vo=va2off(vptr) if vptr else None
            if vo is None or not (0<vlen<20_000_000): continue
            blob=data[vo:vo+vlen]
            try: dec=brotli.decompress(blob)
            except Exception: dec=None
            found[k.decode()]=dec if dec is not None else blob
        if k.decode() in found: break
os.makedirs(out,exist_ok=True)
for k,v in found.items():
    fp=os.path.join(out,k.lstrip('/')); os.makedirs(os.path.dirname(fp),exist_ok=True); open(fp,'wb').write(v)
    print(len(v),k)
