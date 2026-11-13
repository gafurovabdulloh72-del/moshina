import * as T from '../src/terrain.js';
T.initWorld();
const pts = process.argv.slice(2).map(s => s.split(',').map(Number));
for (const [x, z] of pts) console.log(x, z, 'base', T.base0(x, z, true, true).toFixed(1), 'grid', T.gridHeight(x, z).toFixed(1), 'biome', T.biomeAt(x, z));
