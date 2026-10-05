import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validateRoutine, validateSession, localDate } from '../src/app/models.ts';
const routine=JSON.parse(readFileSync(new URL('../public/routine.json',import.meta.url),'utf8'));
test('PDF program contains five days and 68 exercises with stable unique ids',()=>{const p=validateRoutine(routine);assert.equal(p.days.length,5);assert.equal(p.days.flatMap(d=>d.blocks.flatMap(b=>b.exercises)).length,68);assert.deepEqual(p.days.map(d=>d.weekday),[1,2,3,4,5]);});
test('imports reject duplicate ids, missing sets, invalid weekdays and unsafe videos',()=>{for(const mutate of [(p:any)=>p.days[1].id=p.days[0].id,(p:any)=>p.days[0].blocks[0].exercises[0].sets=0,(p:any)=>p.days[0].weekday=8,(p:any)=>p.days[0].blocks[0].exercises[0].videoUrl='javascript:alert(1)']){const p=structuredClone(routine);mutate(p);assert.throws(()=>validateRoutine(p));}});
test('local date uses the browser date without UTC conversion',()=>assert.equal(localDate(new Date(2026,9,4,23,59)),'2026-10-04'));
test('backup rejects missing or malformed exercise logs',()=>{const day=routine.days[0];const s={key:'test',date:'2026-10-05',routineId:routine.id,routineName:routine.name,day,logs:Object.fromEntries(day.blocks.flatMap((b:any)=>b.exercises.map((e:any)=>[e.id,Array.from({length:e.sets},()=>({weight:'',unit:'kg',actual:'',done:false}))]))),results:{},notes:''};assert.equal(validateSession(s).key,'test');const broken=structuredClone(s);broken.logs[day.blocks[0].exercises[0].id]=[];assert.throws(()=>validateSession(broken));});
