# SCANNER ロゴ v10：7セグ＋N・R の斜め線は14セグ風。
# N の上下の斜め線は「同じ1本の帯」（中心 (W/2, H/2) を通る）を上下のセル内側の長方形で切ったもの。
# 端面は縦切り＋横切り。R の斜め線は N の下側と同じ帯（同じ位置・傾き・太さ）を g の下で切ったもの。
import math,sys
H,T,G=72,8,1.2
W0=40
WIDE=float(sys.argv[1]) if len(sys.argv)>1 else 54
WW=float(sys.argv[2]) if len(sys.argv)>2 else 0.8
K=float(sys.argv[3]) if len(sys.argv)>3 else 0.3     # 上端で帯の中心線が上の横線（内側）にぶつかる位置：左上の角から右へ K×太さ
OUT=sys.argv[4] if len(sys.argv)>4 else 'svg10.txt'
h=H/2;o=T/2;gx=1.6
def hseg(x0,x1,y): return [(x0+G,y),(x0+T/2+G,y-T/2),(x1-T/2-G,y-T/2),(x1-G,y),(x1-T/2-G,y+T/2),(x0+T/2+G,y+T/2)]
def vseg(x,y0,y1): return [(x,y0+G),(x+T/2,y0+T/2+G),(x+T/2,y1-T/2-G),(x,y1-G),(x-T/2,y1-T/2-G),(x-T/2,y0+T/2+G)]
def clip(poly,f):
    out=[]
    for i in range(len(poly)):
        p,q=poly[i],poly[(i+1)%len(poly)];a,b=f(p),f(q)
        if a>=0: out.append(p)
        if (a>=0)!=(b>=0):
            t=a/(a-b);out.append((p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])))
    return out
def band(p0,p1,w,box):
    dx,dy=p1[0]-p0[0],p1[1]-p0[1];L=math.hypot(dx,dy);ux,uy=dx/L,dy/L;nx,ny=-uy*w/2,ux*w/2;e=60
    a=(p0[0]-ux*e,p0[1]-uy*e);b=(p1[0]+ux*e,p1[1]+uy*e)
    p=[(a[0]+nx,a[1]+ny),(b[0]+nx,b[1]+ny),(b[0]-nx,b[1]-ny),(a[0]-nx,a[1]-ny)]
    x0,y0,x1,y1=box
    for f in (lambda q:q[0]-x0,lambda q:x1-q[0],lambda q:q[1]-y0,lambda q:y1-q[1]): p=clip(p,f)
    return p
def segs(W):
    w=T*WW;xi0=o+T/2+gx;xi1=W-o-T/2-gx;xm=W/2;yt=o+T/2+G;yb=H-o-T/2-G
    c=(xm,h); p0=(xi0+K*w,yt)           # 帯の中心線：左上 → 中心（下側は点対称で右下へ）
    S={'a':hseg(o,W-o,o),'g':hseg(o,W-o,h),'d':hseg(o,W-o,H-o),'f':vseg(o,o,h),'b':vseg(W-o,o,h),'e':vseg(o,h,H-o),'c':vseg(W-o,h,H-o)}
    S['h']=band(p0,c,w,(xi0,yt,xm-gx/2,h-G))
    S['m']=band(p0,c,w,(xm+gx/2,h+G,xi1,yb))
    # R：N の下側の斜め線をそのまま T/2 だけ下へ（g の下に来る）。下端は e・c の下端と同じ高さ
    d=T/2
    S['r']=band((p0[0],p0[1]+d),(c[0],c[1]+d),w,(xm+gx/2,h+G+d,xi1,yb+d))
    return S
L={'S':'afgcd','C':'afed','A':'abcefg','N':'bcefhm','E':'adefg','R':'abefgr'}
if __name__=='__main__':
    word='SCANNER';gap=12;sk=math.tan(math.radians(8))
    pt=lambda x,y,ox:f"{ox+x+(H-y)*sk:.1f},{y+2:.1f}"
    out=[];ox=2
    for ch in word:
        W=WIDE if ch in 'NR' else W0;S=segs(W)
        for k in L[ch]: out.append('<polygon class="i" points="'+" ".join(pt(x,y,ox) for x,y in S[k])+'"/>')
        ox+=W+gap
    vw=ox-gap+H*sk+2
    open(OUT,'w').write(f'<svg class="logo" viewBox="0 0 {vw:.0f} {H+4}" role="img" aria-label="SCANNER">'+''.join(out)+'</svg>')
