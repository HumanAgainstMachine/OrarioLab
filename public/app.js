const $=s=>document.querySelector(s),days=['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì'];
let timeZone='Europe/Rome';
let schedule=null, day=0, following=true, loadError='', lastActive='';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function badgeStyle(color){
 if(typeof color!=='string'||!/^#[0-9a-f]{6}$/i.test(color))return '';
 const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const luminance=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
 const text=luminance>.179?'#000000':'#FFFFFF';
 return ` style="background-color:${color};color:${text};border-color:${color}"`;
}
function mins(v){const [h,m]=v.split(':').map(Number);return h*60+m}
function current(){const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));const d=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(p.weekday),m=+p.hour*60+(+p.minute);const h=d<5&&schedule?schedule.bells[d].findIndex(v=>{const [a,b]=v.split('-').map(mins);return m>=a&&m<b}):-1;return {d,h,m}}
// Calendar weeks start on Monday. January 1 always belongs to week 1.
function calendarState(now=new Date()) {
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
 const y=+parts.year,m=+parts.month,d=+parts.day;
 const jan=Date.UTC(y,0,1), date=Date.UTC(y,m-1,d);
 const offset=(new Date(jan).getUTCDay()+6)%7;
 const week=1+Math.floor(((date-jan)/86400000+offset)/7);
 const monday=date-((new Date(date).getUTCDay()+6)%7)*86400000;
 const months=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
 const shortDate=value=>{const day=new Date(value);return day.getUTCDate()+'/'+months[day.getUTCMonth()]};
 const range=shortDate(monday)+' - '+shortDate(monday+4*86400000);
 return {range,key:`${parts.year}-${parts.month}-${parts.day}`,week,parity:week%2?'odd':'even'};
}
function occupancy(value,index,row) {
 if(!value)return '<span class="period-status">Libero</span>';
 if(value.toUpperCase()==='M')return '<span class="period-status">manutenzione / pulizia</span>';
 return requestRow(value,index);
}
function requestRow(className, index) {
 const normalize = value => value.normalize('NFKC').toLocaleUpperCase('it').replace(/\s+/g,'');
 const matches = schedule.teachers.filter(teacher => normalize(teacher.slots[index] || '') === normalize(className));
 const teachers = matches.length ? matches : [{name:'Docente non individuato nell’orario'}];
 return teachers.map(teacher => `<div class="day-pair"><span>${esc(teacher.name)}</span><strong class="badge" title="${esc(className)}"${badgeStyle(teacher.color)}>${esc(className)}</strong></div>`).join('');
}

function periodRow(hour,range,currentHour,calendar) {
 const index=schedule.dayOffsets[day]+hour;
 const odd=(schedule.labs[0][index]||'').trim(),even=(schedule.labs[1][index]||'').trim();
 const blocked=even.toLowerCase()==='x';
 const note=(schedule.notes?.[index]||'').trim();
 const active=currentHour===hour;
 function box(label,content,isActive,isOtherWeek=false,noAlternation=false) {
  const parityText=noAlternation?'<span>P/D</span>':`<span>${label==='Pari'?'P':'D'}</span>`;
  return `<div class="occupancy-row"><div class="week-occupancy${isActive?' active-occupancy':''}${isOtherWeek?' other-week':''}"${isActive?' aria-current="time"':''}><div class="occupancy-body">${noAlternation||isActive?'<div class="week-label">'+(noAlternation?'Alternanza non prevista':'')+(isActive?'<span>In corso</span>':'')+'</div>':''}<div class="week-content">${content}</div>${!isOtherWeek&&note?`<div class="period-note">${esc(note)}</div>`:''}</div><div class="week-parity" aria-label="${label}"><div aria-hidden="true">${parityText}</div></div></div></div>`;
 }

 let content;
 if(blocked)content=box('Pari e dispari',occupancy(odd,index,1),active,false,true);
 else {
  const evenContent=occupancy(even,index,2);
  const oddBox=box('Dispari',occupancy(odd,index,1),active&&calendar.parity==='odd',calendar.parity!=='odd');
  const evenBox=box('Pari',evenContent,active&&calendar.parity==='even',calendar.parity!=='even');
  content=calendar.parity==='odd'?oddBox+evenBox:evenBox+oddBox;
 }
 return `<article class="period-row"><div class="period-time"><strong>${hour+1}ª ora</strong><span>${esc(range.replace('-','–'))}</span></div><div class="period-result">${content}</div></article>`;
}

function render(){
 const now = current();
 const calendar=calendarState();
 lastActive = `${calendar.key}:${now.d}:${now.h}`;
 $('#days').innerHTML = days.map((name,i)=>`<button data-day="${i}" class="${day===i?'active':''}" aria-pressed="${day===i}">${name.slice(0,3)}</button>`).join('');
 $('#day-title').textContent = `Settimana ${calendar.range} · ${calendar.parity==='even'?'pari':'dispari'}`;
 $('#day-status').textContent = '';
 if (!schedule) {
  $('#periods').textContent = loadError || 'Caricamento orario…';
  return;
 }
 const closed = following && now.h < 0;
 $('#day-status').textContent = closed ? 'Laboratorio chiuso' : '';
 if (day < 0) { $('#periods').innerHTML=''; return; }

 const currentHour = day === now.d ? now.h : -1;
 $('#periods').innerHTML = schedule.bells[day].map((range,h)=>periodRow(h,range,currentHour,calendar)).join('');
}

function goNow(){
 following = true;
 const weekday = current().d;
 day = weekday < 5 ? weekday : -1;
 render();
}
function selectDay(nextDay){
 if (nextDay < 0 || nextDay > 4) return;
 following = false;
 day = nextDay;
 render();
}
function step(direction){
 selectDay(day < 0 ? (direction > 0 ? 0 : 4) : day + direction);
}
$('#days').onclick = event => {
 const button = event.target.closest('button');
 if (button) selectDay(Number(button.dataset.day));
};
$('#now').onclick = goNow;
$('.schedule').onkeydown = event => {
 if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
  event.preventDefault();step(event.key === 'ArrowLeft' ? -1 : 1);
 }
};
let touch;$('.schedule').addEventListener('touchstart',e=>{if(e.touches.length===1)touch={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});$('.schedule').addEventListener('touchend',e=>{if(!touch)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5)step(dx<0?1:-1);touch=null},{passive:true});$('.schedule').addEventListener('touchcancel',()=>touch=null);
let wheelStamp=0;$('.schedule').addEventListener('wheel',e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY)&&Math.abs(e.deltaX)>15){e.preventDefault();if(Date.now()-wheelStamp>450){step(e.deltaX>0?1:-1);wheelStamp=Date.now()}}},{passive:false});
async function refresh(){
 try {
  const configResponse = await fetch('./config.json',{cache:'no-store'});
  if (!configResponse.ok) throw Error('Impossibile leggere config.json.');
  const config = await configResponse.json();
  if (typeof config.csvFile !== 'string' || !config.csvFile.trim() || typeof config.csvHasHeader !== 'boolean') throw Error('config.json: controlla csvFile e csvHasHeader.');
  const zone = config.timeZone || 'Europe/Rome';
  new Intl.DateTimeFormat('it',{timeZone:zone}).format(new Date());
  const csvURL = new URL(config.csvFile, new URL('./config.json',location.href));
  if (csvURL.origin !== location.origin) throw Error('csvFile deve indicare un file locale al sito.');
  const csvResponse = await fetch(csvURL,{cache:'no-store'});
  if (!csvResponse.ok) throw Error('Impossibile leggere '+config.csvFile+'.');
  const csv = await csvResponse.text();
  if (/<!doctype html|<html/i.test(csv)) throw Error('Il file CSV contiene una pagina HTML.');
  const data = decodeCSV(csv,config.csvHasHeader);
  data.bells = ['lun','mar','mer','gio','ven'].map((key,d)=>{
   const entry=config.days?.[key];
   if (!entry || !Array.isArray(entry.starts) || ![6,7].includes(entry.starts.length)) throw Error(key+': configura 6 o 7 inizi in config.json.');
   const times=[...entry.starts,entry.end];
   if (times.some(t=>typeof t!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) || times.some((t,i)=>i&&mins(t)<=mins(times[i-1]))) throw Error(key+': gli orari devono essere HH:MM e in ordine crescente.');
   if (entry.starts.length<data.hourCounts[d]) throw Error(key+': il CSV contiene 7 ore; aggiungi il settimo inizio e aggiorna end in config.json.');
   return entry.starts.slice(0,data.hourCounts[d]).map((start,i)=>start+'-'+times[i+1]);
  });
  timeZone=zone;
  schedule = data;
 } catch(error) {
  loadError = error.message;
 }
 following ? goNow() : render();
}
function tick(){
 const now = current();
 if (`${calendarState().key}:${now.d}:${now.h}` !== lastActive) following ? goNow() : render();
}
goNow();refresh();
setInterval(tick,15000);
document.addEventListener('visibilitychange',()=>{if (!document.hidden) tick()});

const accountMenu = document.querySelector('.account-menu');
document.addEventListener('click', event => {
 if (accountMenu.open && !accountMenu.contains(event.target)) accountMenu.open = false;
});
document.addEventListener('keydown', event => {
 if (event.key === 'Escape' && accountMenu.open) {
  accountMenu.open = false;
  accountMenu.querySelector('summary').focus();
 }
});
