import sharp from 'sharp'; import {gen} from './harness.mjs';
const out='/tmp/claude-0/t/';
const b=await gen('databarlimitedcomposite','(01)14987117395287|(17)280100(10)5A983',{scale:7});
const m=await sharp(b).metadata();
// 写真風：大きな背景に配置・4°回転・ぼけ・JPEG
const rot=await sharp(b).flatten({background:'#fff'}).rotate(4,{background:'#f4f1ea'}).png().toBuffer();const rm=await sharp(rot).metadata();
await sharp({create:{width:4032,height:3024,channels:3,background:'#d8d2c4'}}).composite([{input:rot,left:1400,top:1200}]).blur(1.5).jpeg({quality:80}).toFile(out+'p_cc.jpg');
// 黒地白（ゾシン風）
await sharp({create:{width:4032,height:3024,channels:3,background:'#e6e2da'}}).composite([{input:await sharp(b).flatten({background:'#fff'}).negate({alpha:false}).png().toBuffer(),left:1500,top:1300}]).blur(1.2).jpeg({quality:80}).toFile(out+'p_cc_inv.jpg');
// 何も写っていない写真
await sharp({create:{width:2000,height:1500,channels:3,background:'#888'}}).jpeg().toFile(out+'p_none.jpg');
console.log('ok',m.width,m.height,rm.width);
