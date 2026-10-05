import { Component, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { SwUpdate } from '@angular/service-worker';
import { Subscription } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';
import { Block, Day, Exercise, Routine, Session, localDate, validateRoutine, validateSession, trackingType, metricType, upgradeSession, removeSession } from './models';
import catalog from './exercise-catalog.json';
const STORAGE='ritmo:v1';
type Theme='system'|'light'|'dark';
interface InstallPrompt extends Event { prompt():Promise<void>; userChoice:Promise<{outcome:'accepted'|'dismissed'}>; }
@Component({selector:'app-root',imports:[FormsModule,DatePipe],templateUrl:'./app.html'})
export class App implements OnDestroy {
 routine=signal<Routine|null>(null); view=signal<'train'|'history'|'settings'>('train'); selected=''; date=localDate();
 sessions=signal<Session[]>([]); drafts:Record<string,Session>={}; current!:Session;
 celebration=signal<Session|null>(null); pendingDelete=signal<Session|null>(null);
 notice=signal(''); loading=signal(true); media=signal<Exercise|null>(null); seconds=signal(0); running=signal(false); timerLabel=signal('Descanso');
 theme=signal<Theme>('system'); dark=signal(false); online=signal(navigator.onLine); installAvailable=signal(false); installed=signal(false); updateAvailable=signal(false); timerOpen=signal(false);
 private installPrompt?:InstallPrompt;
 private systemTheme=window.matchMedia('(prefers-color-scheme: dark)');
 private displayMode=window.matchMedia('(display-mode: standalone)');
 private subscriptions=new Subscription();
 private themeChange=()=>this.applyTheme();
 private networkChange=()=>this.online.set(navigator.onLine);
 private beforeInstall=(event:Event)=>{event.preventDefault();this.installPrompt=event as InstallPrompt;this.installAvailable.set(true);};
 private afterInstall=()=>{this.installed.set(true);this.installAvailable.set(false);this.installPrompt=undefined;};
 private guideTrigger:HTMLElement|null=null;
 private interval?:ReturnType<typeof setInterval>; private deadline=0; private duration=90;
 constructor(private sanitizer:DomSanitizer, private sw:SwUpdate){
  try{const saved=localStorage.getItem('ritmo:theme');if(saved&&['system','light','dark'].includes(saved))this.theme.set(saved as Theme);}catch{}
  this.applyTheme();this.installed.set(this.displayMode.matches||(navigator as Navigator&{standalone?:boolean}).standalone===true);
  this.systemTheme.addEventListener('change',this.themeChange);
  window.addEventListener('online',this.networkChange);window.addEventListener('offline',this.networkChange);
  window.addEventListener('beforeinstallprompt',this.beforeInstall);window.addEventListener('appinstalled',this.afterInstall);
  if(sw.isEnabled){this.subscriptions.add(sw.versionUpdates.subscribe(event=>{if(event.type==='VERSION_READY')this.updateAvailable.set(true);}));}
  void this.load();
 }
 setTheme(value:Theme){this.theme.set(value);try{localStorage.setItem('ritmo:theme',value);}catch{this.notice.set('No pudimos guardar tu preferencia de apariencia.');}this.applyTheme();}
 toggleTheme(){this.setTheme(this.dark()?'light':'dark');}
 private applyTheme(){const dark=this.theme()==='dark'||(this.theme()==='system'&&this.systemTheme.matches);this.dark.set(dark);document.documentElement.dataset['theme']=dark?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#121914':'#f6f7f1');}
 async install(){if(!this.installPrompt){this.notice.set('Android: abre el menú del navegador y elige Instalar aplicación. iPhone: en Safari, Compartir → Añadir a pantalla de inicio.');return;}const prompt=this.installPrompt;this.installPrompt=undefined;this.installAvailable.set(false);await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')this.notice.set('Instalación solicitada. Ritmo quedará en tu pantalla de inicio.');}
 reloadUpdate(){location.reload();}
 weighted(e:Exercise){return trackingType(e)==='weighted';}
 trackingLabel(e:Exercise){return {weighted:'Fuerza',bodyweight:'Sin carga',cardio:'Cardio',mobility:'Movilidad'}[trackingType(e)];}
 metricLabel(e:Exercise){return {reps:e.target.includes('saltos')?'Saltos':'Repeticiones',time:'Tiempo',distance:'Distancia',calories:'Calorías',mixed:'Realizado'}[metricType(e)];}
 metricHint(e:Exercise){return {reps:'reps',time:e.target.includes('min')?'min':'seg',distance:'m',calories:'cal',mixed:'según objetivo'}[metricType(e)];}
 inputMode(e:Exercise){return ['reps','distance','calories'].includes(metricType(e))?'decimal':'text';}
 async load(){
  try {const response=await fetch('routine.json');if(!response.ok)throw Error('No se pudo cargar routine.json.');const bundled=validateRoutine(await response.json());
   let routine=bundled;
   try {const raw=localStorage.getItem(STORAGE);if(raw){const data=JSON.parse(raw);routine=validateRoutine(data.routine);if(!Array.isArray(data.sessions)||!data.drafts||typeof data.drafts!=='object')throw Error();this.sessions.set(data.sessions.map((v:unknown)=>upgradeSession(validateSession(v))));this.drafts=Object.fromEntries(Object.entries(data.drafts).map(([k,v])=>[k,upgradeSession(validateSession(v))]));}}
   catch{this.notice.set('No pudimos leer los datos locales. No se sobrescribirán hasta tu siguiente cambio. Puedes descargar el contenido original en Ajustes.');}
   this.routine.set(routine);this.suggest();
  }catch(error){this.notice.set(error instanceof Error?error.message:'No se pudo cargar el programa.');}finally{this.loading.set(false);}
 }
 get day():Day{return this.routine()!.days.find(d=>d.id===this.selected)!;}
 get total(){return this.current?Object.values(this.current.logs).flat().length:0;}
 get done(){return this.current?Object.values(this.current.logs).flat().filter(s=>s.done).length:0;}
 get progress(){return this.total?Math.round(this.done/this.total*100):0;}
 get restDay(){const weekday=new Date(this.date+'T12:00:00').getDay();return !this.routine()?.days.some(d=>d.weekday===weekday);}
 suggest(){const p=this.routine();if(!p)return;const weekday=new Date(this.date+'T12:00:00').getDay();this.selectDay(p.days.find(d=>d.weekday===weekday)?.id??p.days[0].id);}
 selectDay(id:string){this.stop();this.selected=id;this.openSession();}
 changeDate(){if(!/^\d{4}-\d{2}-\d{2}$/.test(this.date)){this.date=localDate();}this.suggest();}
 openSession(){const p=this.routine()!;const key=`${p.id}:${this.date}:${this.selected}`;this.current=this.drafts[key]?upgradeSession(this.drafts[key]):{key,date:this.date,routineId:p.id,routineName:p.name,day:structuredClone(this.day),logs:Object.fromEntries(this.day.blocks.flatMap(b=>b.exercises.map(e=>[e.id,Array.from({length:e.sets},()=>({weight:'',unit:'kg' as const,actual:'',done:false}))]))),results:{},notes:''};this.drafts[key]=this.current;}
 save(){try{localStorage.setItem(STORAGE,JSON.stringify({version:1,routine:this.routine(),sessions:this.sessions(),drafts:this.drafts}));}catch{this.notice.set('No se pudo guardar en este navegador. Exporta un respaldo para conservar tus cambios.');}}
 update(){this.drafts[this.current.key]=this.current;this.save();}
 toggle(e:Exercise,index:number){const log=this.current.logs[e.id][index];log.done=!log.done;this.update();if(this.done===this.total)this.finish();}
 finish(){if(!this.done){this.notice.set('Marca al menos una serie antes de guardar la sesión.');return;}const completed=structuredClone(this.current);completed.finishedAt=new Date().toISOString();this.sessions.update(s=>[completed,...s.filter(x=>x.key!==completed.key)]);this.save();if(this.done===this.total){this.notice.set('');this.celebration.set(completed);this.timerOpen.set(false);setTimeout(()=>document.querySelector<HTMLButtonElement>('.celebration .primary')?.focus(),0);}else this.notice.set('Sesión parcial guardada. Puedes continuarla cuando quieras.');this.stop();}
 deleteSession(){const session=this.pendingDelete();if(!session)return;const removed=removeSession(this.sessions(),this.drafts,session.key);this.sessions.set(removed.sessions);this.drafts=removed.drafts;if(this.current?.key===session.key){this.stop();this.timerOpen.set(false);this.seconds.set(0);this.openSession();}this.pendingDelete.set(null);this.celebration.set(null);this.save();this.notice.set('Sesión eliminada. Ese entrenamiento quedó limpio para volver a hacerlo.');}
 closeCelebration(history=false){this.celebration.set(null);if(history)this.view.set('history');}

 previous(e:Exercise){const s=this.sessions().find(s=>s.date<this.date && s.logs[e.id]);return s?s.logs[e.id].filter(l=>l.done).map(l=>`${this.weighted(e)&&l.weight?l.weight+' '+l.unit+' · ':''}${l.actual||e.target}`).join(' / '):'';}
 preview(e:Exercise){this.guideTrigger=document.activeElement as HTMLElement;this.media.set(e);setTimeout(()=>document.querySelector<HTMLButtonElement>('.modal .close')?.focus(),0);}
 closeMedia(){this.media.set(null);this.guideTrigger?.focus();}
 modalKey(event:KeyboardEvent){if(event.key==='Escape'){this.closeMedia();return;}if(event.key!=='Tab')return;const nodes=Array.from(document.querySelectorAll<HTMLElement>('.modal button,.modal a,.modal iframe'));const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
 instructions(e:Exercise){return catalog.find(c=>c.id===e.catalogId)?.instructions??[];}
 video(e:Exercise){const id=e.videoUrl?.match(/(?:v=|youtu\.be\/)([\w-]{11})$/)?.[1];return id?this.sanitizer.bypassSecurityTrustResourceUrl('https://www.youtube-nocookie.com/embed/'+id):null;}
 searchVideo(e:Exercise){return 'https://www.youtube.com/results?search_query='+encodeURIComponent(e.name+' exercise technique');}
 timer(seconds:number,label='Descanso'){this.timerOpen.set(true);this.stop();this.duration=seconds;this.seconds.set(seconds);this.timerLabel.set(label);this.start();}
 start(){if(this.running())return;if(this.seconds()<=0)this.seconds.set(this.duration);this.deadline=Date.now()+this.seconds()*1000;this.running.set(true);this.interval=setInterval(()=>{this.seconds.set(Math.max(0,Math.ceil((this.deadline-Date.now())/1000)));if(!this.seconds())this.stop();},250);}
 stop(){if(this.interval)clearInterval(this.interval);this.interval=undefined;this.running.set(false);}
 resetTimer(){this.stop();this.seconds.set(this.duration);}
 clock(){return `${Math.floor(this.seconds()/60).toString().padStart(2,'0')}:${(this.seconds()%60).toString().padStart(2,'0')}`;}
 blockTimer(b:Block){this.timer(b.timerSeconds||90,b.name);}
 download(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
 exportRoutine(){this.download(this.routine(),'routine.json');}
 exportBackup(){this.download({version:1,routine:this.routine(),sessions:this.sessions(),drafts:this.drafts},`ritmo-respaldo-${localDate()}.json`);}
 exportRaw(){try{const raw=localStorage.getItem(STORAGE);this.download(raw?JSON.parse(raw):{},'ritmo-datos-originales.json');}catch{this.notice.set('Los datos originales no contienen un JSON válido.');}}
 async importFile(event:Event,backup=false){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;
  try{if(file.size>5_000_000)throw Error('El archivo debe pesar menos de 5 MB.');const data=JSON.parse(await file.text());const routine=validateRoutine(backup?data.routine:data);
   let sessions=this.sessions(),drafts=this.drafts;
   if(backup){if(data.version!==1||!Array.isArray(data.sessions)||!data.drafts||typeof data.drafts!=='object')throw Error('Respaldo incompatible.');sessions=data.sessions.map((v:unknown)=>upgradeSession(validateSession(v)));drafts=Object.fromEntries(Object.entries(data.drafts).map(([k,v])=>[k,upgradeSession(validateSession(v))]));if(!confirm('¿Restaurar este respaldo y reemplazar los datos actuales? Exporta antes si quieres conservarlos.'))return;}
   else {if(!confirm('¿Cargar este programa? Tu historial se conservará. Los borradores se reiniciarán. Exporta un respaldo antes para conservarlos.'))return;drafts={};}
   this.routine.set(routine);this.sessions.set(sessions);this.drafts=drafts;this.suggest();this.save();this.notice.set(backup?'Respaldo restaurado.':'Programa cargado.');this.view.set('train');
  }catch(error){this.notice.set(error instanceof Error?error.message:'Archivo inválido.');}finally{input.value='';}
 }
 ngOnDestroy(){this.stop();this.subscriptions.unsubscribe();this.systemTheme.removeEventListener('change',this.themeChange);window.removeEventListener('online',this.networkChange);window.removeEventListener('offline',this.networkChange);window.removeEventListener('beforeinstallprompt',this.beforeInstall);window.removeEventListener('appinstalled',this.afterInstall);}
}
