import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root='/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral';
export async function captureWeapon(page,config){
  try{await page.goto('https://www.csbrasil.online/?debug=1&auto=E,esquerdomacho,T&map=quebrada&oficina=1&perfqa=1&lang=pt&perfilauto=0&q=high&bloom=0&vmweapon='+config.weapon);}catch(e){if(!e.message.includes('navigation committed'))throw e;}
  await page.waitForFunction(id=>window.__game?.state==='live'&&window.__game?.player?.weapon===id&&window.__game.time>2,config.weapon,{timeout:45000});
  const meta=await page.evaluate(config=>{
    const g=window.__game;g.update=()=>{};g.player.pos.set(3,0,-28);g.player.yaw=Math.PI;g.player.pitch=0;g.camera.position.set(3,1.62,-28);g.camera.rotation.set(0,Math.PI,0);
    for(const b of g.bots??[])if(b.mesh?.group)b.mesh.group.visible=false;
    if(g.playerTP?.group)g.playerTP.group.visible=false;
    for(const effect of g.scene.userData.softs??[])effect.points.visible=false;
    const canvas=g.renderer.domElement;canvas.id='concept-canvas';const s=document.createElement('style');s.textContent='body *{visibility:hidden!important}#concept-canvas{visibility:visible!important;position:fixed!important;left:0!important;top:0!important;width:1536px!important;height:864px!important;z-index:2147483646!important}';document.head.append(s);
    g.renderer.setPixelRatio(1);g.renderer.setSize(1536,864,false);g.camera.aspect=16/9;g.camera.updateProjectionMatrix();g.vmCamera.aspect=16/9;
    const melee=!!g.vm.melee?.active,authored=!!g.vm.authored?.active(config.weapon);
    if(melee)g.vmCamera.fov=g.vm.melee.fov(16/9);else if(authored)g.vmCamera.fov=g.vm.authored.fov(config.weapon,16/9);
    g.vmCamera.updateProjectionMatrix();g.renderer.render(g.scene,g.camera);g.renderer.autoClear=false;g.renderer.clearDepth();g.renderer.render(g.vmScene,g.vmCamera);g.renderer.autoClear=true;
    return{weapon:g.player.weapon,family:config.family,map:g._mapId,position:g.camera.position.toArray(),rotation:g.camera.rotation.toArray(),fov:g.camera.fov,vmFov:g.vmCamera.fov,presentation:melee?'melee':authored?'authored':'fallback',postprocessing:'bloom=0 existing runtime option; raw world plus real vmScene overlay. Default postprocessing produced an obstructed frozen capture, not diagnosed as a production defect.',main:[...document.scripts].map(s=>s.src).find(s=>s.includes('/js/main.js')),source:'production',url:location.href,synthetic:true,capturedAt:new Date().toISOString()};
  },config);
  await mkdir(root+'/baseline/weapons',{recursive:true});const id='weapon-'+config.weapon,path=root+'/baseline/weapons/'+id+'.png',shot=await page.cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip:{x:0,y:0,width:1536,height:864,scale:1}});await writeFile(path,Buffer.from(shot.data,'base64'));
  const c={id,name:config.name,category:'weapons',path,...meta,inspected:false},m=JSON.parse(await readFile(root+'/capture-manifest.json'));m.captures=m.captures.filter(c=>c.id!==id);m.captures.push(c);await writeFile(root+'/capture-records/'+id+'.json',JSON.stringify(c,null,2));await writeFile(root+'/capture-manifest.json',JSON.stringify(m,null,2));console.log({captured:id,presentation:meta.presentation});
}
