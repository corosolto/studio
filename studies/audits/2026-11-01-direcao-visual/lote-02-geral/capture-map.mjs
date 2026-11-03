import { readFile, writeFile, mkdir } from 'node:fs/promises';
const root = '/Volumes/Zenith/Projects/game/corosolto/csbrasil/audits/2026-11-01-direcao-visual/lote-02-geral';
export async function captureMap(page, config) {
  const base = config.base ?? 'https://www.csbrasil.online';
  try { await page.goto(`${base}/?debug=1&auto=E,esquerdomacho,T&map=${config.map}&oficina=1&perfqa=1&lang=pt&perfilauto=0&q=high`); } catch(e) { if(!e.message.includes("navigation committed")) throw e; }
  await page.waitForFunction(id => window.__game?._mapId === id && window.__game?.state === 'live', config.map, { timeout: 45000 });
  const metadata = await page.evaluate(config => {
    const g = window.__game;
    g.update = () => {};
    for (const bot of g.bots ?? []) if (bot.mesh?.group) bot.mesh.group.visible = false;
    if (g.playerTP?.group) g.playerTP.group.visible = false;
    if (g.vm?.root) g.vm.root.visible = false;
    const canvas = g.renderer.domElement;
    canvas.id = 'concept-canvas';
    const style = document.createElement('style');
    style.textContent = 'body *{visibility:hidden!important}#concept-canvas{visibility:visible!important;position:fixed!important;left:0!important;top:0!important;width:1536px!important;height:864px!important;z-index:2147483646!important}';
    document.head.append(style);
    g.renderer.setPixelRatio(1); g.renderer.setSize(1536, 864, false);
    const bounds = g.world.bounds;
    const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2;
    const from = config.position ?? [cx + (bounds.maxX - bounds.minX) * .3, 10, cz - (bounds.maxZ - bounds.minZ) * .35];
    const look = config.lookAt ?? [cx, 2, cz];
    g.camera.aspect = 16 / 9; g.camera.fov = config.fov ?? 65;
    g.camera.position.set(...from); g.camera.lookAt(...look); g.camera.updateProjectionMatrix();
    g.renderer.render(g.scene, g.camera);
    return { map: g._mapId, bounds, position: from, lookAt: look, fov: g.camera.fov, main: [...document.scripts].map(s => s.src).find(s => s.includes('/js/main.js')), url: location.href, source: config.base.includes('localhost') || location.hostname === '127.0.0.1' ? 'local-preview' : 'production', synthetic: true, actorCountHidden: g.bots?.length ?? 0, capturedAt: new Date().toISOString() };
  }, { ...config, base });
  await mkdir(root + '/baseline/maps', { recursive: true });
  const image = await page.cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, clip: { x: 0, y: 0, width: 1536, height: 864, scale: 1 } });
  const path = root + '/baseline/maps/' + config.map + (config.suffix ?? '') + '.png';
  await writeFile(path, Buffer.from(image.data, 'base64'));
  const manifest = JSON.parse(await readFile(root + '/capture-manifest.json', 'utf8'));
  const id = 'map-' + config.map + (config.suffix ?? '');
  manifest.captures = manifest.captures.filter(item => item.id !== id);
  manifest.captures.push({ id, category: config.category ?? 'maps', name: config.name, path, ...metadata, inspected: false });
  await writeFile(root + '/capture-records/'+id+'.json',JSON.stringify(manifest.captures.find(c=>c.id===id),null,2));
  await writeFile(root + '/capture-manifest.json', JSON.stringify(manifest, null, 2));
  console.log({ captured: id, position: metadata.position, lookAt: metadata.lookAt, bounds: metadata.bounds, inspected: false });
}
