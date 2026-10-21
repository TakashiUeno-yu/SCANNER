/* ---------- GS1 合成シンボル（CC-A / CC-B）デコーダ ----------
   ISO/IEC 24723。DataBar 等の直上（または直下）にある 2D 部分を、
   行パターン検出 → コードワード → GF(929) 誤り訂正 → GS1 汎用ビット列の復号 の順で読む。
   パターン表は BWIPP（MIT, Terry Burton）の micropdf417 / gs1-cc から抽出。 */
const CCDecoder=(function(){
  // ---- 表 ----
  const CW=new Map(), RLR=new Map(), RC=new Map();
  CC_TBL.c.forEach((s,cl)=>s.split(",").forEach((h,v)=>CW.set(parseInt(h,16),cl*1000+v)));
  CC_TBL.r[0].split(",").forEach((h,i)=>RLR.set(parseInt(h,16),i));
  CC_TBL.r[1].split(",").forEach((h,i)=>RC.set(parseInt(h,16),i));
  //            c  r ecw rl rc rr
  const CCA=[[2,5,4,39,0,19],[2,6,4,1,0,33],[2,7,5,32,0,12],[2,8,5,8,0,40],[2,9,6,14,0,46],[2,10,6,43,0,23],[2,12,7,20,0,52],
    [3,4,4,11,43,23],[3,5,5,1,33,13],[3,6,6,5,37,17],[3,7,7,15,47,27],[3,8,7,21,1,33],
    [4,3,4,40,20,52],[4,4,5,43,23,3],[4,5,6,46,26,6],[4,6,7,34,14,46],[4,7,8,29,9,41]];
  const CCB=[[2,8,8,1,0,1],[2,11,9,1,0,9],[2,14,9,8,0,8],[2,17,10,36,0,36],[2,20,11,19,0,19],[2,23,13,9,0,17],[2,26,15,27,0,35],
    [3,6,12,1,1,1],[3,8,14,7,7,7],[3,10,16,15,15,15],[3,12,18,25,25,25],[3,15,21,37,37,37],[3,20,26,1,17,33],[3,26,32,1,9,17],[3,32,38,21,29,37],[3,38,44,15,31,47],[3,44,50,1,25,49],
    [4,4,8,47,19,43],[4,6,12,1,1,1],[4,8,14,7,7,7],[4,10,16,15,15,15],[4,12,18,25,25,25],[4,15,21,37,37,37],[4,20,26,1,17,33],[4,26,32,1,9,17],[4,32,38,21,29,37],[4,38,44,15,31,47],[4,44,50,1,25,49]];
  const BITCAP_A={2:[167,138,118,108,88,78,59],3:[167,138,118,98,78],4:[197,167,138,108,78]};
  // 行の並び（L=左RAP, C=中央RAP, W=コードワード, R=右RAP+終端バー）
  const GRAM=[
    {id:"A2",c:2,cca:true, seq:"LWWR"},
    {id:"A3",c:3,cca:true, seq:"WCWWR"},
    {id:"A4",c:4,cca:true, seq:"LWWCWWR"},
    {id:"B3",c:3,cca:false,seq:"LWCWWR"}
  ];
  const EL={L:{n:6,m:10},C:{n:6,m:10},W:{n:8,m:17},R:{n:7,m:11}};
  GRAM.forEach(g=>{g.runs=0;g.mods=0;for(const ch of g.seq){g.runs+=EL[ch].n;g.mods+=EL[ch].m}});

  // ---- 1要素（ラン列）→ ビットパターン ----
  function sampleBits(r,o,n,m){
    let W=0;for(let i=0;i<n;i++)W+=r[o+i];
    let v=0,pos=0,k=0,acc=r[o];
    for(let j=0;j<m;j++){
      const x=(j+0.5)*W/m;
      while(x>acc&&k<n-1){k++;acc+=r[o+k]}
      v=v*2+((k%2===0)?1:0);
    }
    return v;
  }
  function roundBits(r,o,n,m){
    let W=0;for(let i=0;i<n;i++)W+=r[o+i];
    const w=[];let s=0;
    for(let i=0;i<n;i++){let q=Math.max(1,Math.round(r[o+i]*m/W));w.push(q);s+=q}
    while(s!==m){ // 誤差の大きい要素で合わせる
      let bi=-1,be=-1e9;
      for(let i=0;i<n;i++){const e=(s>m)?(w[i]-r[o+i]*m/W):(r[o+i]*m/W-w[i]);if(e>be&&(s<m||w[i]>1)){be=e;bi=i}}
      if(bi<0)return -1; w[bi]+=(s>m)?-1:1; s+=(s>m)?-1:1;
    }
    let v=0;for(let i=0;i<n;i++)for(let q=0;q<w[i];q++)v=v*2+((i%2===0)?1:0);
    return v;
  }
  function look(map,r,o,n,m){
    let v=sampleBits(r,o,n,m);if(map.has(v))return map.get(v);
    v=roundBits(r,o,n,m);if(v>=0&&map.has(v))return map.get(v);
    return -1;
  }
  function lookR(r,o){ // 右RAP(10)+終端バー(1) = 11モジュール, 7ラン
    let v=sampleBits(r,o,7,11);if((v&1)&&RLR.has(v>>1))return RLR.get(v>>1);
    v=roundBits(r,o,7,11);if(v>=0&&(v&1)&&RLR.has(v>>1))return RLR.get(v>>1);
    return -1;
  }

  // ---- ラン列から行を探す ----
  function rowsFromRuns(runs,first,out){
    // runs[i] の色: first が 1(バー) なら偶数番目がバー
    for(let s=0;s<runs.length;s++){
      if(((s%2===0)?first:1-first)!==1) continue; // バー始まりのみ
      for(const g of GRAM){
        if(s+g.runs>runs.length) continue;
        let o=s,ok=true,L=-1,C=-1,R=-1,cl=-1,cws=[],wsum=0;
        let tot=0;for(let i=0;i<g.runs;i++)tot+=runs[s+i];
        const mod=tot/g.mods;
        for(const ch of g.seq){
          const e=EL[ch];let w=0;for(let i=0;i<e.n;i++)w+=runs[o+i];
          if(Math.abs(w/mod-e.m)>e.m*0.22){ok=false;break}
          if(ch==="W"){const x=look(CW,runs,o,8,17);if(x<0){ok=false;break}const c=(x/1000)|0;if(cl<0)cl=c;else if(cl!==c){ok=false;break}cws.push(x%1000)}
          else if(ch==="L"){L=look(RLR,runs,o,6,10);if(L<0){ok=false;break}}
          else if(ch==="C"){C=look(RC,runs,o,6,10);if(C<0){ok=false;break}}
          else {R=lookR(runs,o);if(R<0){ok=false;break}}
          o+=e.n;
        }
        if(ok) out.push({g:g.id,L,C,R,cl,cws});
      }
    }
  }

  // ---- 走査線の取り出しと二値化 ----
  function profile(gray,w,h,ax,ay,bx,by,step,band,sig){
    const len=Math.hypot(bx-ax,by-ay),n=Math.max(2,Math.floor(len/step));
    const raw=new Float32Array(n),dx=(bx-ax)/(n-1),dy=(by-ay)/(n-1);
    const qx=-dy/Math.hypot(dx,dy),qy=dx/Math.hypot(dx,dy); // 線に直交
    const offs=band>0.6?[-band,0,band]:[0];
    for(let i=0;i<n;i++){
      let acc=0,cnt=0;
      for(const o of offs){
        const x=ax+dx*i+qx*o,y=ay+dy*i+qy*o;
        if(x<0||y<0||x>=w-1||y>=h-1)continue;
        const x0=x|0,y0=y|0,fx=x-x0,fy=y-y0,k=y0*w+x0;
        acc+=(gray[k]*(1-fx)+gray[k+1]*fx)*(1-fy)+(gray[k+w]*(1-fx)+gray[k+w+1]*fx)*fy;cnt++;
      }
      raw[i]=cnt?acc/cnt:NaN;
    }
    if(!(sig>0.5))return raw;
    // 線に沿ったガウス平滑化
    const r=Math.ceil(sig*2.5),ker=[];let ks=0;for(let j=-r;j<=r;j++){const v=Math.exp(-j*j/(2*sig*sig));ker.push(v);ks+=v}
    const p=new Float32Array(n);
    for(let i=0;i<n;i++){let a=0,ws=0;for(let j=-r;j<=r;j++){const v=raw[i+j];if(v===undefined||v!==v)continue;a+=v*ker[j+r];ws+=ker[j+r]}p[i]=ws?a/ws:NaN}
    return p;
  }
  function thresholds(p,win){
    const n=p.length,thr=new Float32Array(n),W=2*win+1;
    const fmin=new Float32Array(n),fmax=new Float32Array(n),bmin=new Float32Array(n),bmax=new Float32Array(n);
    for(let i=0;i<n;i++){const v=p[i]!==p[i]?NaN:p[i];const st=i%W===0;
      fmin[i]=(st||!(fmin[i-1]<=v))?(v!==v?1e9:(st?v:Math.min(fmin[i-1],v))):fmin[i-1];
      fmax[i]=(st||!(fmax[i-1]>=v))?(v!==v?-1e9:(st?v:Math.max(fmax[i-1],v))):fmax[i-1];
      if(v!==v){if(st){fmin[i]=1e9;fmax[i]=-1e9}}
    }
    for(let i=n-1;i>=0;i--){const v=p[i];const en=(i%W===W-1)||i===n-1;
      const vv=v!==v;bmin[i]=en?(vv?1e9:v):Math.min(bmin[i+1],vv?1e9:v);bmax[i]=en?(vv?-1e9:v):Math.max(bmax[i+1],vv?-1e9:v)}
    for(let i=0;i<n;i++){const a=Math.max(0,i-win),b=Math.min(n-1,i+win);
      const mn=Math.min(bmin[a],fmin[b]),mx=Math.max(bmax[a],fmax[b]);thr[i]=(mx-mn<24)?-1:(mx+mn)/2}
    return thr;
  }
  function runsOf(p,inv,thr){
    const n=p.length;
    const runs=[];let first=-1,start=0,cur=-1;
    for(let i=0;i<n;i++){
      const v=p[i];if(v!==v||thr[i]<0){if(cur>=0){runs.push(i-start);}cur=-2;continue}
      const dark=inv?(v>thr[i]):(v<thr[i]);const c=dark?1:0;
      if(cur<0){cur=c;start=i;if(first<0)first=c;continue}
      if(c!==cur){
        const t=thr[i],a=p[i-1],b=v,f=(a===b)?0.5:(t-a)/(b-a);
        const edge=i-1+Math.min(1,Math.max(0,f));
        runs.push(edge-start);start=edge;cur=c;
      }
    }
    if(cur>=0)runs.push(n-start);
    return {runs,first};
  }
  function mergeTiny(runs,first,minw){ // 細いランを前後と1本にまとめる（1パス）
    const out=[];let f=first,i=0;
    while(i<runs.length&&runs[i]<minw){i++;f=1-f} // 先頭の細いランは捨てる
    for(;i<runs.length;i++){
      const v=runs[i];
      if(v<minw&&out.length&&i+1<runs.length){out[out.length-1]+=v+runs[i+1];i++;continue}
      out.push(v);
    }
    return {runs:out,first:f};
  }
  // ---- GF(929) 誤り訂正（zxing の PDF417 ErrorCorrection を移植） ----
  const EXP=new Int32Array(929),LOG=new Int32Array(929);
  {let x=1;for(let i=0;i<929;i++){EXP[i]=x;x=(x*3)%929}for(let i=0;i<928;i++)LOG[EXP[i]]=i}
  const add=(a,b)=>(a+b)%929,sub=(a,b)=>(929+a-b)%929,inv=a=>EXP[928-LOG[a]];
  const mul=(a,b)=>(a===0||b===0)?0:EXP[(LOG[a]+LOG[b])%928];
  function P(c){let i=0;while(i<c.length-1&&c[i]===0)i++;return i?c.slice(i):c.slice()}
  const deg=p=>p.length-1, coef=(p,d)=>p[p.length-1-d], isZ=p=>p[0]===0;
  function ev(p,a){if(a===0)return coef(p,0);let r=0;if(a===1){for(const c of p)r=add(r,c);return r}r=p[0];for(let i=1;i<p.length;i++)r=add(mul(a,r),p[i]);return r}
  function padd(a,b){if(isZ(a))return b;if(isZ(b))return a;let s=a,l=b;if(s.length>l.length){s=b;l=a}const d=l.length-s.length,r=l.slice(0,d);for(let i=d;i<l.length;i++)r.push(add(s[i-d],l[i]));return P(r)}
  const neg=p=>P(p.map(c=>(929-c)%929)), psub=(a,b)=>isZ(b)?a:padd(a,neg(b));
  function pmul(a,b){if(isZ(a)||isZ(b))return[0];const r=new Array(a.length+b.length-1).fill(0);for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)r[i+j]=add(r[i+j],mul(a[i],b[j]));return P(r)}
  const pscale=(p,s)=>s===0?[0]:P(p.map(c=>mul(c,s)));
  function mono(d,c){if(c===0)return[0];const r=new Array(d+1).fill(0);r[0]=c;return r}
  function pmulMono(p,d,c){if(c===0)return[0];const r=p.map(x=>mul(x,c));for(let i=0;i<d;i++)r.push(0);return P(r)}
  function rsDecode(rec,k){
    const p=P(rec.slice()),S=new Array(k);let err=false;
    for(let i=k;i>0;i--){const e=ev(p,EXP[i]);S[k-i]=e;if(e)err=true}
    if(!err)return 0;
    let a=mono(k,1),b=P(S);if(deg(a)<deg(b)){const t=a;a=b;b=t}
    let rL=a,r=b,tL=[0],t=[1];
    while(deg(r)>=k/2){
      const rLL=rL,tLL=tL;rL=r;tL=t;
      if(isZ(rL))return -1;
      r=rLL;let q=[0];const dlt=inv(coef(rL,deg(rL)));
      while(deg(r)>=deg(rL)&&!isZ(r)){const dd=deg(r)-deg(rL),sc=mul(coef(r,deg(r)),dlt);q=padd(q,mono(dd,sc));r=psub(r,pmulMono(rL,dd,sc))}
      t=neg(psub(pmul(q,tL),tLL));
    }
    const s0=coef(t,0);if(s0===0)return -1;
    const iv=inv(s0),sigma=pscale(t,iv),omega=pscale(r,iv);
    const ne=deg(sigma),locs=[];
    for(let i=1;i<929&&locs.length<ne;i++)if(ev(sigma,i)===0)locs.push(inv(i));
    if(locs.length!==ne)return -1;
    const fd=[];for(let i=1;i<=ne;i++)fd[ne-i]=mul(i,coef(sigma,i));
    const fdp=P(fd.length?fd:[0]);
    for(const L of locs){
      const xi=inv(L),num=sub(0,ev(omega,xi)),den=inv(ev(fdp,xi)),mag=mul(num,den);
      const pos=rec.length-1-LOG[L];if(pos<0)return -1;
      rec[pos]=sub(rec[pos],mag);
    }
    return ne;
  }

  // ---- コードワード → ビット列 ----
  function bitsCCA(cws,bitcap){
    let bits="",c=0,b=0;
    while(b<bitcap){
      const bsl=Math.min(69,bitcap-b),csl=Math.floor(bsl/10)+1;
      let v=0n;for(let i=0;i<csl;i++){const x=cws[c+i];if(x===undefined||x>927)return null;v=v*928n+BigInt(x)}
      if(v>=(1n<<BigInt(bsl)))return null;
      bits+=v.toString(2).padStart(bsl,"0");b+=bsl;c+=csl;
    }
    return bits;
  }
  function bitsCCB(cws){
    if(cws[0]!==920||(cws[1]!==924&&cws[1]!==901))return null;
    const bytes=[];let i=2;
    const end=(()=>{let e=cws.length;for(let j=2;j<cws.length;j++)if(cws[j]>=900){e=j;break}return e})();
    while(i+5<=end&&(cws[1]===924||end-i>5||(end-i===5&&cws[1]===924))){
      let v=0n;for(let j=0;j<5;j++)v=v*900n+BigInt(cws[i+j]);
      const six=[];for(let j=0;j<6;j++){six.unshift(Number(v%256n));v/=256n}
      bytes.push(...six);i+=5;
    }
    for(;i<end;i++){if(cws[i]>255)return null;bytes.push(cws[i])}
    return bytes.map(x=>x.toString(2).padStart(8,"0")).join("");
  }

  // ---- GS1 汎用ビット列の復号 ----
  const FNC="\u001d";
  function gpfDecode(bits,pos,mode){
    let out="";const L=bits.length;
    const rd=n=>{const v=parseInt(bits.substr(pos,n),2);pos+=n;return v};
    const pk=n=>parseInt(bits.substr(pos,n),2);
    while(pos<L){
      const rem=L-pos;
      if(mode==="N"){
        if(rem>=7){
          if(pk(4)===0){pos+=4;mode="A";continue}
          const v=rd(7)-8;if(v<0)return null;const d1=(v/11)|0,d2=v%11;
          out+=(d1===10?FNC:String(d1))+(d2===10?FNC:String(d2));
        }else if(rem>=4){const v=rd(4);if(v===0){mode="A";break}out+=String(v-1);break}
        else break;
      }else if(mode==="A"){
        if(rem<3)break;
        if(pk(3)===0){pos+=3;mode="N";continue}
        if(rem<5)break;
        const v5=pk(5);
        if(v5===4){pos+=5;mode="I";continue}
        if(v5>=5&&v5<=14){pos+=5;out+=String.fromCharCode(48+v5-5);continue}
        if(v5===15){pos+=5;out+=FNC;mode="N";continue}
        if(rem<6)break;
        const v6=rd(6);
        if(v6>=32&&v6<=57)out+=String.fromCharCode(65+v6-32);
        else if(v6===58)out+="*";
        else if(v6>=59&&v6<=62)out+=String.fromCharCode(44+v6-59);
        else return null;
      }else{ // ISO646
        if(rem<3)break;
        if(pk(3)===0){pos+=3;mode="N";continue}
        if(rem<5)break;
        const v5=pk(5);
        if(v5===4){pos+=5;mode="A";continue}
        if(v5>=5&&v5<=14){pos+=5;out+=String.fromCharCode(48+v5-5);continue}
        if(v5===15){pos+=5;out+=FNC;mode="N";continue}
        if(rem<7)break;
        const v7=pk(7);
        if(v7>=64&&v7<=89){pos+=7;out+=String.fromCharCode(v7+1);continue}
        if(v7>=90&&v7<=115){pos+=7;out+=String.fromCharCode(v7+7);continue}
        if(rem<8)break;
        const v8=rd(8);
        if(v8===232)out+="!";else if(v8===233)out+='"';
        else if(v8>=234&&v8<=244)out+=String.fromCharCode(v8-197);
        else if(v8>=245&&v8<=250)out+=String.fromCharCode(v8-187);
        else if(v8===251)out+="_";else if(v8===252)out+=" ";
        else return null;
      }
    }
    return out;
  }
  // AI の長さ（固定長のもの）。それ以外は FNC1 まで
  function aiInfo(s){
    const two=s.substr(0,2),n2=+two;
    const FIX2={"00":18,"01":14,"02":14,"03":14,"04":16,"11":6,"12":6,"13":6,"14":6,"15":6,"16":6,"17":6,"18":6,"19":6,"20":2,"41":13};
    if(/^(00|01|02|03|04|1[1-9]|20)$/.test(two))return {len:2,fix:FIX2[two]};
    if(/^(10|21|22|30|37|9\d)$/.test(two))return {len:2,fix:0};
    if(/^(23|24|25|40|42|71|72)/.test(s))return {len:3,fix:0};
    if(/^41/.test(s))return {len:3,fix:13};
    if(/^(3[1-6])/.test(s))return {len:4,fix:6};
    if(/^(39|43|70|80|81|82)/.test(s))return {len:4,fix:0};
    if(/^7003/.test(s))return {len:4,fix:10};
    return {len:2,fix:0};
  }
  function parseAIs(str){ // FNC1 区切りの AI 連結 → [[ai,val]...]
    const out=[];let i=0;
    while(i<str.length){
      if(str[i]===FNC){i++;continue}
      const inf=aiInfo(str.substr(i,4));const ai=str.substr(i,inf.len);if(!/^\d+$/.test(ai))return null;i+=inf.len;
      let val;
      if(inf.fix){val=str.substr(i,inf.fix);i+=inf.fix}
      else{let j=str.indexOf(FNC,i);if(j<0)j=str.length;val=str.slice(i,j);i=j}
      if(!val)return null;
      out.push([ai,val]);
    }
    return out;
  }
  function decodeBits(bits){
    let pos=0;const ais=[];
    if(bits[0]==="1"&&bits[1]==="0"){ // 方式 10：(11)/(17) と (10)
      pos=2;
      if(bits.substr(pos,2)==="11"){pos+=2}
      else{
        const v=parseInt(bits.substr(pos,16),2);pos+=16;
        const yy=Math.floor(v/384),mm=Math.floor((v%384)/32)+1,dd=v%32;
        if(yy>99||mm>12||dd>31)return null;
        const ai=bits[pos]==="1"?"17":"11";pos+=1;
        ais.push([ai,String(yy).padStart(2,"0")+String(mm).padStart(2,"0")+String(dd).padStart(2,"0")]);
      }
      const g=gpfDecode(bits,pos,"N");if(g===null)return null;
      const k=g.indexOf(FNC);const lot=k<0?g:g.slice(0,k);
      if(lot)ais.push(["10",lot]);
      if(k>=0){const r=parseAIs(g.slice(k+1));if(r===null)return null;ais.push(...r)}
    }else if(bits[0]==="0"){
      const g=gpfDecode(bits,1,"N");if(g===null)return null;
      const r=parseAIs(g);if(r===null)return null;ais.push(...r);
    }else return null; // 方式 11（AI 90）は未対応
    if(!ais.length)return null;
    return ais;
  }

  // ---- 本体：直線部の四隅から 2D 部を探す ----
  function scanAt(gray,w,h,cx,cy,Lq,thq,th,opt){
    const ex=Math.cos(th),ey=Math.sin(th),nx=ey,ny=-ex;
    const cosd=Math.abs(Math.cos(th-thq));
    const Lp=Math.min(Lq*1.3,Lq/Math.max(0.5,cosd));
    const ux=ex*Lp,uy=ey*Lp;
    const X=Lp/(opt.linMods||74);
    const step=Math.max(0.35,Math.min(1,X/4));
    const win=Math.max(8,Math.round(X*12/step));
    const found=[];
    const ox=cx-ux/2,oy=cy-uy/2; // 中心線の左端
    for(const sgn of [1,-1]){
      for(let d=3*X;d<=40*X;d+=Math.max(0.5,X/2)){
        const px=nx*sgn*d,py=ny*sgn*d;
        const ax=ox+px-ex*14*X,ay=oy+py-ey*14*X,bx=ox+ux+px+ex*12*X,by=oy+uy+py+ey*12*X;
        const p=profile(gray,w,h,ax,ay,bx,by,step,X*0.35,X*0.18/step);
        const thr=thresholds(p,win);
        for(const iv of [false,true]){
          const ro=runsOf(p,iv,thr);
          for(const mw of [0,0.45*X/step]){
            const {runs,first}=mw?mergeTiny(ro.runs,ro.first,mw):ro;
            if(runs.length<20)continue;
            const rows=[];rowsFromRuns(runs,first,rows);
            for(const r of rows){r.side=sgn;r.inv=iv;found.push(r)}
          }
        }
      }
    }
    return found;
  }
  function solve(found,opt){
    if(!found.length)return null;
    const votes=new Map();
    for(const r of found){
      const key=[r.g,r.L,r.C,r.R,r.cl].join(":");
      let e=votes.get(key);if(!e){e={g:r.g,L:r.L,C:r.C,R:r.R,cl:r.cl,cnt:0,col:r.cws.map(()=>new Map())};votes.set(key,e)}
      e.cnt++;r.cws.forEach((v,i)=>e.col[i].set(v,(e.col[i].get(v)||0)+1));
    }
    const cands=[];
    for(const g of GRAM){
      for(const m of (g.cca?CCA:CCB)){
        const [c,r,k,rl,rc,rr]=m;if(c!==g.c)continue;
        const rowsArr=new Array(r).fill(null);let hit=0,bad=0;
        for(const e of votes.values()){
          if(e.g!==g.id)continue;
          const i=((e.R-rr+1)%52+52)%52;
          if(i>=r){bad+=e.cnt;continue}
          if(e.L>=0&&((i+rl-1)%52+52)%52!==e.L){bad+=e.cnt;continue}
          if(e.C>=0&&((i+rc-1)%52+52)%52!==e.C){bad+=e.cnt;continue}
          if(((i+rl-1)%3+3)%3!==e.cl){bad+=e.cnt;continue}
          if(!rowsArr[i]||rowsArr[i].cnt<e.cnt)rowsArr[i]=e;
          hit+=e.cnt;
        }
        const have=rowsArr.filter(Boolean).length;
        if(!have)continue;
        cands.push({g,m,rowsArr,hit,bad,have});
      }
    }
    if(opt.debug)opt.debug.cands=cands;
    cands.sort((a,b)=>(b.have/b.m[1])-(a.have/a.m[1])||b.hit-a.hit);
    for(const cd of cands){
      const [c,r,k]=cd.m;
      const cws=[];let miss=0;
      for(let i=0;i<r;i++){
        const e=cd.rowsArr[i];
        for(let j=0;j<c;j++){
          if(!e){cws.push(0);miss++;continue}
          let best=0,bc=-1;for(const [v,n] of e.col[j])if(n>bc){bc=n;best=v}
          cws.push(best);
        }
      }
      if(miss*2>k)continue; // 欠けは誤りとして訂正（k/2 まで）
      const fix=cws.slice();const ne=rsDecode(fix,k);if(ne<0)continue;
      if(ne*2>k)continue;
      const data=fix.slice(0,r*c-k);
      let bits=null;
      if(cd.g.cca){const caps=BITCAP_A[c];const cap=caps[[...CCA].filter(x=>x[0]===c).reverse().findIndex(x=>x[1]===r)];bits=cap?bitsCCA(data,cap):null}
      else bits=bitsCCB(data);
      if(!bits)continue;
      const ais=decodeBits(bits);if(!ais)continue;
      return {ais,text:ais.map(([a,v])=>"("+a+")"+v).join(""),type:cd.g.cca?"CC-A":"CC-B",cols:c,rows:r,corrected:ne,missingRows:cd.rowsArr.filter(x=>!x).length};
    }
    return null;
  }
  function decode(gray,w,h,quad,opt){
    opt=opt||{};
    const tl=quad.topLeft,tr=quad.topRight,bl=quad.bottomLeft,br=quad.bottomRight;
    const ux=(tr.x-tl.x+br.x-bl.x)/2,uy=(tr.y-tl.y+br.y-bl.y)/2;const Lq=Math.hypot(ux,uy);
    if(!(Lq>20))return null;
    const cx=(tl.x+tr.x+bl.x+br.x)/4,cy=(tl.y+tr.y+bl.y+br.y)/4;
    const thq=Math.atan2(uy,ux);
    // バーの向きを勾配の構造テンソルで推定（zxing の位置は回転していても水平なことがあるため）
    let tht=thq;
    {
      const R=Lq*0.42,st=Math.max(1,Math.round(R/90));let sxx=0,syy=0,sxy=0;
      const c=Math.cos(thq),s_=Math.sin(thq);
      for(let a=-R;a<=R;a+=st)for(let b=-R*0.06;b<=R*0.06;b+=st){ // 直線部の帯の中だけ
        const x=Math.round(cx+c*a-s_*b),y=Math.round(cy+s_*a+c*b);
        if(x<1||y<1||x>=w-1||y>=h-1)continue;
        const k=y*w+x,gx=gray[k+1]-gray[k-1],gy=gray[k+w]-gray[k-w];
        sxx+=gx*gx;syy+=gy*gy;sxy+=gx*gy;
      }
      const t2=0.5*Math.atan2(2*sxy,sxx-syy),coh=Math.hypot(sxx-syy,2*sxy)/(sxx+syy+1e-9);
      if(coh>0.3){let t=t2;if(Math.cos(t-thq)<0)t+=Math.PI;tht=t}
    }
    // 角度の候補：zxing の向き → 勾配の向き → その周りを 0.8° 刻みで
    const D=Math.PI/180,angs=[thq,tht];
    for(const k of [0.8,1.6,2.4,3.2,4.0,5.0,6.0])angs.push(tht+k*D,tht-k*D);
    const uniq=[];for(const t of angs)if(!uniq.some(u=>Math.abs(u-t)<0.3*D))uniq.push(t);
    const all=[];const t0=Date.now();
    let ai=0;
    for(const th of uniq){
      if(ai++===2&&all.length<4)break; // 合成シンボルらしい行がほとんど無い → 打ち切り
      const f=scanAt(gray,w,h,cx,cy,Lq,thq,th,opt);
      if(opt.debug)(opt.debug.angles=opt.debug.angles||[]).push([+(th/D).toFixed(1),f.length]);
      if(f.length){const r=solve(f,opt);if(r){r.angle=+(th/D).toFixed(1);return r}all.push(...f)}
      if(opt.timeLimit&&Date.now()-t0>opt.timeLimit)break;
    }
    if(opt.debug)opt.debug.found=all;
    return solve(all,opt);
  }
  return {decode,_rs:rsDecode,_bits:{bitsCCA,decodeBits},_rows:rowsFromRuns,_look:look,CW,RC,RLR};
})();
