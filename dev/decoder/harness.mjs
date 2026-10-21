import fs from 'fs'; import sharp from 'sharp'; import bwip from 'bwip-js';
import {readBarcodes,prepareZXingModule} from 'zxing-wasm/reader';
const wb=fs.readFileSync('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm');
prepareZXingModule({overrides:{wasmBinary:wb.buffer.slice(wb.byteOffset,wb.byteOffset+wb.byteLength)},fireImmediately:false});
const src=fs.readFileSync('tables.js','utf8')+fs.readFileSync('cc-core.js','utf8')+';globalThis.CCDecoder=CCDecoder;';
(0,eval)(src);
export async function gen(bcid,text,o={}){return bwip.toBuffer({bcid,text,scale:o.scale||4,paddingwidth:40,paddingheight:40,backgroundcolor:"FFFFFF",includetext:false,...(o.bw||{})})}
export async function load(buf){
  const {data,info}=await sharp(buf).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const w=info.width,h=info.height,g=new Uint8Array(w*h);
  for(let i=0;i<w*h;i++)g[i]=(data[i*4]*299+data[i*4+1]*587+data[i*4+2]*114)/1000|0;
  const rs=await readBarcodes({data:new Uint8ClampedArray(data),width:w,height:h,colorSpace:"srgb"},{formats:["DataBarLimited","DataBar","DataBarExpanded","EAN-13","Code128"],tryHarder:true,tryInvert:true,maxNumberOfSymbols:4});
  return {g,w,h,rs};
}
export async function run(buf,label){
  const t0=Date.now();const {g,w,h,rs}=await load(buf);
  const lin=rs.find(r=>r.isValid);
  if(!lin){console.log(label,'| linear NG');return null}
  const r=CCDecoder.decode(g,w,h,lin.position,{});
  console.log(label,'|',lin.format,lin.text,'|',r?r.text+' '+r.type+' '+r.cols+'x'+r.rows+' corr='+r.corrected+' miss='+r.missingRows:'CC NG','|',Date.now()-t0,'ms');
  return r;
}
export async function loadInv(buf){ // 直線部が読めないときは反転して読む（ページ側と同じ手順）
  const r=await load(buf);if(r.rs.some(x=>x.isValid))return r;
  const {data,info}=await sharp(buf).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let i=0;i<data.length;i+=4){data[i]=255-data[i];data[i+1]=255-data[i+1];data[i+2]=255-data[i+2]}
  const rs=await readBarcodes({data:new Uint8ClampedArray(data),width:info.width,height:info.height,colorSpace:"srgb"},{formats:["DataBarLimited","DataBar","DataBarExpanded","EAN-13","Code128"],tryHarder:true,maxNumberOfSymbols:4});
  return {...r,rs};
}
export async function quads(buf){ // ページ側と同じ：通常→回転なし→反転 の順に位置候補を集める
  const {data,info}=await sharp(buf).toColourspace('srgb').ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const img=d=>({data:new Uint8ClampedArray(d),width:info.width,height:info.height,colorSpace:"srgb"});
  const F=["DataBarLimited","DataBar","DataBarExpanded","EAN-13","Code128"];
  const out=[];
  for(const o of [{tryRotate:true},{tryRotate:false,formats:["DataBarLimited","DataBar","DataBarExpanded"]}]){
    const rs=await readBarcodes(img(data),{formats:F,tryHarder:true,maxNumberOfSymbols:4,...o});
    rs.filter(r=>r.isValid).forEach(r=>out.push(r));
  }
  if(!out.length){const d2=Buffer.from(data);for(let i=0;i<d2.length;i+=4){d2[i]=255-d2[i];d2[i+1]=255-d2[i+1];d2[i+2]=255-d2[i+2]}
    (await readBarcodes(img(d2),{formats:F,tryHarder:true,tryRotate:false,maxNumberOfSymbols:4})).filter(r=>r.isValid).forEach(r=>out.push(r))}
  return out;
}
