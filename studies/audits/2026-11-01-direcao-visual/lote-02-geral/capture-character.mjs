import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root='/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral';
export async function captureCharacter(page,config){
 const metadata=await page.evaluate(async config=>{
  const g=window.__game;if(!g||g._mapId!=='quebrada')throw Error('Expected real Quebrada game scene');g.update=()=>{};
  for(const b of g.bots??[]) if(b.mesh?.group)b.mesh.group.visible=false;
  if(g.playerTP?.group)g.playerTP.group.visible=false;if(g.vm?.root)g.vm.root.visible=false;
  if(window.__conceptActor)g.scene.remove(window.__conceptActor.group);
  const mod=await import('/js/glbchars.js'),chars=await import('/js/characters.js');
  const def=chars.CHARACTERS.find(c=>c.id===config.character);if(!def)throw Error('Missing character');
  await mod.preloadCharacterAssets([def.id]);if(config.skin)await mod.preloadCosmeticAssets([config.skin]);
  const actor=mod.buildCharacterModel({...def,skinId:config.skin},{weapon:false});if(!actor)throw Error('Missing 3D model');
  const baseGeometries=new Set();mod.getCharTemplate(def.id).traverse(o=>{if(o.isMesh)baseGeometries.add(o.geometry.uuid)});
  let distinct=0;actor.group.traverse(o=>{if(o.isMesh&&o.isSkinnedMesh&&!baseGeometries.has(o.geometry.uuid))distinct++;});
  if(config.skin&&!distinct)throw Error('Requested cosmetic fell back to base: '+config.skin);
  for(let i=0;i<15;i++)actor.ctrl.update(1/30,0,false,0);
  const x=6,z=-16,y=g.world.groundHeightAt(x,z);actor.group.position.set(x,y,z);actor.group.rotation.y=0;g.scene.add(actor.group);window.__conceptActor=actor;
  const board=document.createElement('canvas');board.id='concept-board';board.width=1536;board.height=864;const ctx=board.getContext('2d');
  const existing=document.getElementById('concept-board');if(existing)existing.remove();document.body.append(board);
  const style=document.createElement('style');style.textContent='body *{visibility:hidden!important}#concept-board{visibility:visible!important;position:fixed!important;left:0!important;top:0!important;width:1536px!important;height:864px!important;z-index:2147483647!important}';document.head.append(style);
  g.renderer.setPixelRatio(1);g.renderer.setSize(512,864,false);g.camera.aspect=512/864;g.camera.fov=38;g.camera.updateProjectionMatrix();
  const angles=[['frente',0],['perfil',Math.PI/2],['costas',Math.PI]],views=[];
  for(let i=0;i<3;i++){
   const [angle,a]=angles[i],r=4.8;const pos=[x+Math.sin(a)*r,y+1.1,z+Math.cos(a)*r];g.camera.position.set(...pos);g.camera.lookAt(x,y+.95,z);g.renderer.render(g.scene,g.camera);ctx.drawImage(g.renderer.domElement,i*512,0,512,864);views.push({angle,position:pos,lookAt:[x,y+.95,z],fov:38});
  }
  ctx.fillStyle='#ffffff';ctx.fillRect(511,0,2,864);ctx.fillRect(1023,0,2,864);
  return{character:def.id,skin:config.skin??null,map:'quebrada',position:[x,y,z],views,triptych:true,pose:'single frozen unarmed idle; same pose and spot in all three views',skinGeometryVerified:config.skin?distinct>0:null,main:[...document.scripts].map(s=>s.src).find(s=>s.includes('/js/main.js')),source:'production-assets-staged-in-production-map',synthetic:true,capturedAt:new Date().toISOString()};
 },config);
 await mkdir(root+'/baseline/'+config.category,{recursive:true});const path=root+'/baseline/'+config.category+'/'+config.id+'.png';
 const shot=await page.cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip:{x:0,y:0,width:1536,height:864,scale:1}});await writeFile(path,Buffer.from(shot.data,'base64'));
 const p=root+'/capture-manifest.json',m=JSON.parse(await readFile(p));m.captures=m.captures.filter(c=>c.id!==config.id);m.captures.push({id:config.id,name:config.name,category:config.category,path,...metadata,inspected:false});await writeFile(root+'/capture-records/'+config.id+'.json',JSON.stringify(m.captures.find(c=>c.id===config.id),null,2));await writeFile(p,JSON.stringify(m,null,2));console.log({captured:config.id,skin:metadata.skin,skinGeometryVerified:metadata.skinGeometryVerified});
}
