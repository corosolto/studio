import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=async f=>JSON.parse(await readFile(root+'/'+f));
const captures=(await read('capture-manifest.json')).captures;
const generation=await read('generation-manifest.json');
const reviews=[];
for(const name of ['maps','characters','skins','extras']){
  const r=await read('reviews/'+name+'-review.json');
  reviews.push(...(r.items??r.results??r.reviews??[]).map(item=>({...item,reviewFile:'reviews/'+name+'-review.json'})));
}
const errors=[],assets=new Map();
async function inspect(file){
  if(assets.has(file))return assets.get(file);
  const b=await readFile(file),s=await stat(file);
  if(b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')errors.push('Not PNG: '+file);
  const result={bytes:s.size,width:b.readUInt32BE(16),height:b.readUInt32BE(20),sha256:createHash('sha256').update(b).digest('hex')};assets.set(file,result);return result;
}
const expected=captures.filter(c=>c.inspected).flatMap(c=>['B-'+c.id,'C-'+c.id]);
if(captures.length!==68||captures.some(c=>!c.inspected))errors.push('Expected 68 inspected captures');
if(generation.concepts.length!==136)errors.push('Expected 136 concepts');
for(const list of [expected,generation.concepts.map(c=>c.id),reviews.map(r=>r.id)])if(new Set(list).size!==list.length)errors.push('Duplicate identifiers');
const summary={total:0,APROVADO:0,REPROVADO:0,categories:{},styles:{}};
for(const c of generation.concepts){
  if(!expected.includes(c.id))errors.push('Unexpected concept: '+c.id);
  const a=await inspect(c.path),r=await inspect(c.reference);
  if(a.sha256!==c.sha256||a.bytes!==c.bytes)errors.push('Concept hash/bytes mismatch: '+c.id);
  if(r.sha256!==c.referenceSha256)errors.push('Reference hash mismatch: '+c.id);
  const capture=captures.find(r=>r.id===c.capture);
  if(capture?.path!==c.reference)errors.push('Reference changed: '+c.id);
  const review=reviews.find(r=>r.id===c.id),verdict=review?.verdict??review?.reviewStatus;
  if(!review)errors.push('Missing review: '+c.id);
  else{
    if(!(review.checkedPixels||review.pixelsInspected))errors.push('Pixels not confirmed: '+c.id);
    if(!['APROVADO','REPROVADO'].includes(verdict))errors.push('Missing verdict: '+c.id);
    const failures=review.findings??review.failures??[];
    if(verdict==='REPROVADO'&&!failures.length)errors.push('Rejection without finding: '+c.id);
  }
  c.review=verdict??'pending';c.reviewFile=review?.reviewFile;
  summary.total++;summary[verdict]=(summary[verdict]??0)+1;
  for(const [group,key]of[['categories',c.category],['styles',c.style]]){summary[group][key]??={APROVADO:0,REPROVADO:0};summary[group][key][verdict]=(summary[group][key][verdict]??0)+1;}
}
for(const id of expected)if(!generation.concepts.some(c=>c.id===id))errors.push('Missing concept: '+id);
for(const review of reviews)if(!expected.includes(review.id))errors.push('Review without expected concept: '+review.id);
const validation={at:new Date().toISOString(),status:errors.length?'incomplete':'passed-for-2D-comparison',captures:captures.length,concepts:generation.concepts.length,reviewed:reviews.length,uniquePNGFiles:assets.size,totalPNGBytes:[...assets.values()].reduce((n,a)=>n+a.bytes,0),conceptDimensions:[...new Set(generation.concepts.map(c=>{const a=assets.get(c.path);return a.width+'x'+a.height;}))],errors,limits:['Artifact coverage and integrity, not gameplay or performance validation.','APROVADO is reference fidelity only. Owner editorial choice remains pending.','Rejected concepts are shown as finish references with visible corrections; they are not integration requirements.']};
await writeFile(root+'/validation.json',JSON.stringify(validation,null,2));
await writeFile(root+'/review-summary.json',JSON.stringify(summary,null,2));
if(!errors.length){
  generation.status='complete-for-2D-comparison';generation.completedAt=validation.at;generation.reviewSummary=summary;await writeFile(root+'/generation-manifest.json',JSON.stringify(generation,null,2));
  const coverage=await read('coverage.json');coverage.updatedAt=validation.at;coverage.status='complete-for-declared-2D-scope';for(const [category,group]of Object.entries(coverage.groups)){group.generated=generation.concepts.filter(c=>c.category===category).length;group.reviewed=reviews.filter(r=>r.category===category||generation.concepts.find(c=>c.id===r.id)?.category===category).length;}coverage.actual={studies:captures.length,concepts:generation.concepts.length};await writeFile(root+'/coverage.json',JSON.stringify(coverage,null,2));
  const priority=await read('map-priority.json');for(const map of priority.maps)map.status='base-inspected-B-C-generated-and-reviewed';await writeFile(root+'/map-priority.json',JSON.stringify(priority,null,2));
}
console.log(validation);if(errors.length)process.exitCode=1;
