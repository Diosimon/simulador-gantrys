// config.js — Constantes: tiempos, colores, geometría de ejes. Cambia aquí tiempos de proceso y dimensiones.
// Se carga como script clásico (sin módulos) para que funcione abriendo index.html directo.

// ===== constants =====
const C = {or:[.94,.54,.24], bl:[.33,.55,1], ye:[.96,.77,.26], gr:[.47,.85,.58], re:[.93,.30,.28], wood:[.80,.58,.35],
  raw:[.70,.74,.80], frame:[.80,.82,.85], dark:[.12,.12,.13]};
let curScn=null;
function setTiempo(id,v){const e=document.getElementById(id); if(e) e.value=v;}
function leerTiempos(){
  const n=(id,def)=>{const e=document.getElementById(id); const v=e?parseFloat(e.value):NaN; return v>0?v:def;};
  PROC=n('tProc',PROC); LOAD=n('tLoad',LOAD); UNLOAD=n('tUnload',UNLOAD);
}
let PROC=30, LOAD=5, UNLOAD=5;
// Velocidades de los gantrys (unidades/s). Base = valores al 100 %; la barra VELOCIDAD las ajusta en %.
const VEL_BASE={y:2.6,x:1.3,z:1.6}; let VEL={...VEL_BASE};
function leerVelocidad(){
  const n=id=>{const e=document.getElementById(id); const v=e?parseFloat(e.value):NaN; return v>0?v/100:1;};
  VEL={y:VEL_BASE.y*n('vY'),x:VEL_BASE.x*n('vX'),z:VEL_BASE.z*n('vZ')};
}
let ESPEJO=false;   // true = la línea empieza a la derecha (Bufer 1) y termina a la izquierda (Descarga)
let B2_STOCK=2;   // piezas nuevas que G1 deja listas en el Bufer 2 para el Banco 2   // segundos; se cambian desde la barra TIEMPOS de la pantalla
const REST=3.25, GH=0.47;
const LV=n=>0.30+(5-n)*0.56;
const LANE={A:-1.05,B:1.05,C:1.05,D:-1.05};
const SAFE={G1:6.2,G2:10.0};
