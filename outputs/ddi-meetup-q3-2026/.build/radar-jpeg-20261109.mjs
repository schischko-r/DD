import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';

const root='/Users/roman/Documents/Codex/DD-dev';
const folder=`${root}/outputs/ddi-meetup-q3-2026`;
const pptx=`${folder}/final/DDI_митап_сравнение_II_III_кварталы_2026_v9.pptx`;
const digest=async p=>createHash('sha256').update(await fs.readFile(p)).digest('hex');
const beforeHash=await digest(pptx);
const data=JSON.parse(await fs.readFile(`${folder}/.build/fresh-data.json`,'utf8'));
const codes=['general','goals','attract','churn','alerts','mehaniki','hyp','cx'];
assert.deepEqual(data.radar.map(p=>p.code),codes);
assert.ok(data.radar.every(p=>[p.previous,p.b2c].every(v=>Number.isFinite(v)&&v>=0&&v<=100)));
const cx=600,cy=388,r=145;
const points=values=>values.map((v,i)=>{const a=-Math.PI/2+2*Math.PI*i/8;return[cx+Math.cos(a)*r*v/100,cy+Math.sin(a)*r*v/100];});
const polygon=pts=>pts.map(p=>p.map(v=>v.toFixed(3)).join(',')).join(' ');
const parts=[];
for(let ring=1;ring<=5;ring++) parts.push(`<polygon points="${polygon(points(Array(8).fill(ring*20)))}" fill="none" stroke="#D9E1E5" stroke-width="1"/>`);
for(const [x,y]of points(Array(8).fill(100)))parts.push(`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#D9E1E5" stroke-width="1"/>`);
for(const [key,color,width]of[['previous','#92999B',2],['b2c','#2A9FDB',3]]){
 const pts=points(data.radar.map(p=>p[key]));
 parts.push(`<polygon points="${polygon(pts)}" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"/>`);
 for(const[x,y]of pts)parts.push(`<circle cx="${x}" cy="${y}" r="3" fill="${color}" stroke="#FFFFFF" stroke-width="1"/>`);
}
const labels=[
 ['Метрики',600,223,'middle'],['Цели',735,250,'start'],['Привлечение',753,388,'start'],
 ['Отток',735,512,'start'],['Алерты',600,552,'middle'],['Механики',487,512,'end'],
 ['Гипотезы',437,388,'end'],['CX',460,250,'end'],
];
for(const[text,x,y,anchor]of labels)parts.push(`<text x="${x}" y="${y}" dominant-baseline="middle" text-anchor="${anchor}" font-size="14" fill="#65747A">${text}</text>`);
parts.push('<rect x="500" y="577" width="12" height="12" fill="#92999B"/>');
parts.push('<text x="518" y="584" dominant-baseline="middle" font-size="14" fill="#65747A">II кв. 2026</text>');
parts.push('<rect x="650" y="577" width="12" height="12" fill="#2A9FDB"/>');
parts.push('<text x="668" y="584" dominant-baseline="middle" font-size="14" fill="#117CB4">III кв. 2026</text>');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1290" viewBox="300 190 600 430"><rect x="300" y="190" width="600" height="430" fill="#FFFFFF"/><g font-family="SB Sans Display,Arial,sans-serif">${parts.join('')}</g></svg>`;
await fs.writeFile(`${folder}/.build/radar-20261109.svg`,svg);
const output=`${folder}/final/Паутина_DDI_II_III_2026_09-11.jpeg`;
await sharp(Buffer.from(svg)).flatten({background:'#FFFFFF'}).jpeg({quality:98,chromaSubsampling:'4:4:4'}).toFile(output);
const meta=await sharp(output).metadata();
assert.deepEqual([meta.width,meta.height,meta.format],[1800,1290,'jpeg']);
assert.equal(await digest(pptx),beforeHash,'original v9 deck stays unchanged');
await fs.writeFile(`${folder}/.build/radar-20261109-data.json`,JSON.stringify({
 generatedAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim(),
 sourcePresentation:pptx,sourceHash:beforeHash,q2Teams:83,q3Teams:data.teams,radar:data.radar,
 output,width:meta.width,height:meta.height,
},null,2));
console.log(JSON.stringify({output,width:meta.width,height:meta.height,radar:data.radar}));
