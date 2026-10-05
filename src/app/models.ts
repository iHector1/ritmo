export type Tracking = 'weighted' | 'bodyweight' | 'cardio' | 'mobility';
export type Metric = 'reps' | 'time' | 'distance' | 'calories' | 'mixed';
export interface Exercise { id:string; name:string; target:string; sets:number; tracking?:Tracking; metric?:Metric; notes?:string; catalogId?:string; videoUrl?:string; }
export interface Block { id:string; name:string; notes?:string; timerSeconds?:number; exercises:Exercise[]; }
export interface Day { id:string; label:string; weekday:number; focus:string; blocks:Block[]; }
export interface Routine { schemaVersion:1; id:string; name:string; description:string; days:Day[]; }
export interface SetLog { weight:string; unit:'kg'|'lb'; actual:string; done:boolean; }
export interface Session { key:string; date:string; routineId:string; routineName:string; day:Day; logs:Record<string,SetLog[]>; results:Record<string,string>; notes:string; finishedAt?:string; }
// Legacy routines and saved sessions keep their IDs and records; missing metadata is inferred.
export function trackingType(e:Exercise):Tracking {
 if(e.tracking)return e.tracking;
 const n=e.name.toLowerCase();
 if(/^(bike|run)(\s|$)|^row(?! kb)(\s|$)|trote/.test(n))return 'cardio';
 if(/90\/90|rotaci|swimmers|t,? y,? w|shoulder taps|cossack|bootraper|glute bridge/.test(n))return 'mobility';
 if(/press|peck deck|extension|soga|row kb|gorilla|curl|predicador|hip thrust|hipthrust|bulgarian|deadlift|back squat|mb |dual db|dual kb|lateral raise|lateral walk|walking lunge|american swing|farmer|russian twist|plate crunch|pull down|pull over/.test(n))return 'weighted';
 return 'bodyweight';
}
export function metricType(e:Exercise):Metric {
 if(e.metric)return e.metric;
 const t=e.target.toLowerCase();
 if(/\+|\//.test(t))return 'mixed';
 if(/cal/.test(t))return 'calories';
 if(/\bmin\b|\bs\b/.test(t))return 'time';
 if(/\bm\b/.test(t))return 'distance';
 return 'reps';
}
export function upgradeSession(s:Session):Session {
 for(const b of s.day.blocks)for(const e of b.exercises){e.tracking??=trackingType(e);e.metric??=metricType(e);}
 return s;
}
export function validateRoutine(value:unknown):Routine {
 const p=value as Routine;
 const str=(v:unknown)=>typeof v==='string' && v.length>0 && v.length<=2000;
 if (!p || p.schemaVersion!==1 || !str(p.id) || !str(p.name) || typeof p.description!=='string' || !Array.isArray(p.days) || !p.days.length || p.days.length>7) throw Error('El JSON debe incluir schemaVersion: 1, id, name, description y de 1 a 7 days.');
 const ids=new Set<string>(), weekdays=new Set<number>();
 const unique=(id:string)=>{if(!str(id)||["__proto__","constructor","prototype"].includes(id)||ids.has(id))throw Error('Todos los ids deben ser únicos y no vacíos.');ids.add(id);};
 unique(p.id);
 for(const d of p.days){
  unique(d.id);
  if(!str(d.label)||!str(d.focus)||!Number.isInteger(d.weekday)||d.weekday<0||d.weekday>6||weekdays.has(d.weekday)||!Array.isArray(d.blocks)||!d.blocks.length||d.blocks.length>20)throw Error('Cada día necesita label, focus, weekday único (0–6) y blocks.');
  weekdays.add(d.weekday);
  for(const b of d.blocks){
   unique(b.id);
   if(!str(b.name)||!Array.isArray(b.exercises)||!b.exercises.length||b.exercises.length>100|| (b.notes!==undefined&&typeof b.notes!=='string') || (b.timerSeconds!==undefined&&(!Number.isInteger(b.timerSeconds)||b.timerSeconds<0||b.timerSeconds>7200)))throw Error('Revisa los bloques, ejercicios y timerSeconds (0–7200).');
   for(const e of b.exercises){
    unique(e.id);
    if(!str(e.name)||!str(e.target)||!Number.isInteger(e.sets)||e.sets<1||e.sets>30|| (e.notes!==undefined&&typeof e.notes!=='string') || (e.catalogId!==undefined&&typeof e.catalogId!=='string'))throw Error('Cada ejercicio necesita name, target y sets (1–30).');
    if(e.tracking!==undefined&&!['weighted','bodyweight','cardio','mobility'].includes(e.tracking))throw Error('tracking debe ser weighted, bodyweight, cardio o mobility.');
    if(e.metric!==undefined&&!['reps','time','distance','calories','mixed'].includes(e.metric))throw Error('metric debe ser reps, time, distance, calories o mixed.');
    if(e.videoUrl!==undefined && (typeof e.videoUrl!=='string'||!/^https:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]{11}$/.test(e.videoUrl)))throw Error('videoUrl debe ser https://www.youtube.com/watch?v=ID o https://youtu.be/ID (11 caracteres).');
   }
  }
 }
 return p;
}
export function localDate(date=new Date()):string {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function validateSession(value:unknown):Session {
 const s=value as Session;
 if(!s||typeof s.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||typeof s.key!=='string'||typeof s.routineId!=='string'||typeof s.routineName!=='string'||typeof s.notes!=='string'||!s.logs||!s.results||typeof s.results!=='object')throw Error('Sesión inválida en el respaldo.');
 validateRoutine({schemaVersion:1,id:s.routineId,name:s.routineName,description:'',days:[s.day]});
 for(const b of s.day.blocks){if(s.results[b.id]!==undefined&&typeof s.results[b.id]!=='string')throw Error('Resultado inválido.');for(const e of b.exercises){const sets=s.logs[e.id];if(!Array.isArray(sets)||sets.length!==e.sets||sets.some(l=>!l||typeof l.weight!=='string'||typeof l.actual!=='string'||typeof l.done!=='boolean'||!['kg','lb'].includes(l.unit)))throw Error('Series inválidas en el respaldo.');}}
 if(s.finishedAt!==undefined&&(typeof s.finishedAt!=='string'||Number.isNaN(Date.parse(s.finishedAt))))throw Error('Fecha inválida.');
 return s;
}
