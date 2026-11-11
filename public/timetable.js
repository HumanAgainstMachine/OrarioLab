function parseCSV(s){s=s.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){row.push(cell);rows.push(row);row=[];cell='';if(c==='\r'&&s[i+1]==='\n')i++}else cell+=c}if(quoted)throw Error('CSV: virgolette non chiuse.');if(cell||row.length){row.push(cell);rows.push(row)}return rows}
function decodeCSV(s,header){
 let rows=parseCSV(s).map((cells,i)=>({cells,line:i+1}));if(header)rows.shift();
 rows=rows.filter(row=>row.cells.some(cell=>cell.trim()));
 const label=row=>row?.cells[0].trim().replace(/\s+/g,' ').toLowerCase();
 if (rows.some(row=>label(row)==='lab 3')) throw Error('CSV: rimuovi Lab 3. Le ultime due righe devono essere Lab 1 e Lab 2.');
 if (label(rows.at(-2))!=='lab 1'||label(rows.at(-1))!=='lab 2') throw Error('CSV: le ultime due righe devono essere Lab 1 e Lab 2, in questo ordine.');
 const labRows=rows.splice(-2);
 if(rows.some(row=>/^lab [12]$/.test(label(row))))throw Error('CSV: righe Lab duplicate.');
 const teachers = rows.filter(row => row.cells.some(cell => cell.trim()));
 if (teachers.length < 1 || teachers.length > 20) throw Error('Sono ammessi da 1 a 20 docenti, oltre alle righe del laboratorio.');
 const allRows = [...teachers, ...labRows.filter(Boolean)];
 for(const r of allRows)if(r.cells.length!==37)throw Error(`Riga ${r.line}: trovate ${r.cells.length} colonne, ne servono 37 (nome + Colore + 7 ore per ciascun giorno).`);
 const hourCounts=Array.from({length:5},(_,d)=>allRows.some(r=>r.cells[2+d*7+6].trim()!=='')?7:6);
 const dayOffsets=hourCounts.map((_,d)=>hourCounts.slice(0,d).reduce((a,b)=>a+b,0));
 const slots=r=>hourCounts.flatMap((n,d)=>r.cells.slice(2+d*7,2+d*7+n).map(v=>v.trim()));

 for(const r of teachers)if(!r.cells[0].trim())throw Error(`Riga ${r.line}: manca il nome del docente.`);
 return {teachers:teachers.map(r=>({name:r.cells[0].trim(),color:/^#[0-9a-f]{6}$/i.test(r.cells[1].trim())?r.cells[1].trim().toUpperCase():null,slots:slots(r)})),labs:labRows.map(row => row ? slots(row) : []),lab:slots(labRows[0]),alternation:labRows[1] ? slots(labRows[1]) : [],hourCounts,dayOffsets};
}
