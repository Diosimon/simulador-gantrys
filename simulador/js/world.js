// world.js — Modelo del mundo: posiciones (slots), pallets, gantrys, escenarios y bitácora.
// Se carga como script clásico (sin módulos) para que funcione abriendo index.html directo.

// ===== world =====
let S={}, pid=0, simT=0, stats, logArr=[], lockOwner=null, G={};
function mkSlot(id,kind,x,y,z,o={}){S[id]=Object.assign({id,kind,x,y,z,pallet:null,res:null,timer:0,prog:0,fault:false},o);}
function pal(piece){return {id:++pid,piece,claimed:false};}
function build(){
  S={}; pid=0;
  for(let p=0;p<3;p++)for(let n=1;n<=5;n++){const num=p*5+n; mkSlot('B1-'+String(num).padStart(2,'0'),'B1',0,0.5+p,LV(n),{level:n,col:p,label:String(num).padStart(2,'0')});}
  for(let n=1;n<=5;n++){
    mkSlot('B2-'+String(n).padStart(3,'0'),'B2',0,7.75,LV(n),{level:n,col:'L',label:String(n).padStart(3,'0')});
    mkSlot('B2-'+String(n+5).padStart(3,'0'),'B2',0,8.45,LV(n),{level:n,col:'R',label:String(n+5).padStart(3,'0')});
  }
  mkSlot('ALIM','ALIM',0,4.3,0.80,{label:'ALIMENTACIÓN'});
  mkSlot('BK1','BK',0,6.2,1.0,{label:'BANCO 1'});
  mkSlot('BK2','BK',0,10.0,1.0,{label:'BANCO 2'});
  mkSlot('D1','DESC',0,11.8,0.7,{label:'1'});
  mkSlot('D2','DESC',0,12.6,0.7,{label:'2'});
}
const B1=()=>Object.values(S).filter(s=>s.kind==='B1');
const B2=()=>Object.values(S).filter(s=>s.kind==='B2');
const pairOf=s=>S['B2-'+String(s.col==='L'?s.level+5:s.level).padStart(3,'0')];
const pairFree=n=>{const a=S['B2-'+String(n).padStart(3,'0')],b=S['B2-'+String(n+5).padStart(3,'0')];return !a.pallet&&!b.pallet&&!a.res&&!b.res;};
const colOf=arm=>(arm==='A'||arm==='D')?'L':'R';
const b2slot=(n,col)=>S['B2-'+String(col==='L'?n:n+5).padStart(3,'0')];
function b2Free(arm){for(const n of [4,3,2,1]) if(pairFree(n)) return b2slot(n,colOf(arm)); return null;}
function avail(s,piece){return s.pallet&&!s.pallet.claimed&&s.pallet.piece===piece;}

class Gantry{
  constructor(name,col,arms,gy){this.name=name;this.col=col;this.arms=arms;this.v={gy};arms.forEach(a=>{this.v[a+'.x']=LANE[a];this.v[a+'.z']=REST;});
    this.hold={};arms.forEach(a=>this.hold[a]=null);this.q=[];this.cur=null;this.el=0;this.rule='Esperando…';this.txt='Sin tarea';this.wait=0;}
  get front(){return this.arms[1];} get back(){return this.arms[0];}
}
function initScenario(sc){
  build(); simT=0; lockOwner=null; logArr=[]; stats={done:0,load:0};
  // Tiempos desde la barra TIEMPOS (si no existe, quedan los de config.js). «Descarga lenta» fuerza 28 s.
  if(sc==='slow') setTiempo('tUnload',28); else if(curScn==='slow') setTiempo('tUnload',5);
  curScn=sc; leerTiempos(); leerVelocidad();
  const b1=B1().sort((a,b)=>a.level-b.level||a.col-b.col);
  const nB1=sc==='b1low'?3:15;
  // Bufer 1 siempre lleno: 15 pallets; los que no traen pieza son vacíos.
  b1.forEach((s,i)=>{ s.pallet=pal(i>=15-nB1?'raw':'none'); });
  S.ALIM.pallet=pal('raw');
  S.BK1.pallet=pal('raw'); S.BK1.prog=0.45;
  S.BK2.pallet=pal('raw'); S.BK2.prog=0.75;
  S.D2.pallet=pal('none');
  if(sc==='f1') S.BK1.fault=true;
  if(sc==='f2') S.BK2.fault=true;
  if(sc==='pair'){S['B2-001'].pallet=pal('none');S['B2-006'].pallet=pal('raw');}
  // Bufer 2 en home: N pallets (barra LÍNEA), uno por nivel, alternando pieza nueva (izq) y vacío (der).
  else { const e=document.getElementById('nB2'); const n=e?Math.max(0,Math.min(4,parseInt(e.value)||0)):4;
    for(let lv=1;lv<=n;lv++) S[b2slot(lv,lv%2?'L':'R').id].pallet=pal(lv%2?'raw':'none'); }
  G.G1=new Gantry('G1',C.or,['A','B'],5.2);
  G.G2=new Gantry('G2',C.bl,['D','C'],10.6);
  // Línea real: cada gantry anda siempre con un pallet en un gripper (21 pallets en total:
  // 15 Bufer 1 + alimentación + 2 bancos + descarga + 1 en cada gantry).
  G.G1.hold.A=pal('none'); G.G2.hold.C=pal('none');
  log('Inicio: escenario «'+document.getElementById('scn').selectedOptions[0].text.replace('Escenario: ','')+'».');
  syncFaultBtns();
}

// ===== logging =====
function fmt(t){const m=Math.floor(t/60),s=Math.floor(t%60);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');}
function log(m){logArr.unshift([simT,m]); if(logArr.length>60)logArr.pop(); renderLog();}
function renderLog(){document.getElementById('log').innerHTML=logArr.map(([t,m])=>`<div><span class="t">${fmt(t)}</span>${m}</div>`).join('');}
let toastT=0;function toast(m){const e=document.getElementById('toast');e.textContent=m;e.style.opacity=1;clearTimeout(toastT);toastT=setTimeout(()=>e.style.opacity=0,1800);}
