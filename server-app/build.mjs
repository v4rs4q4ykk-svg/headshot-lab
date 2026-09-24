import {readFileSync,writeFileSync,mkdirSync,rmSync,readdirSync,copyFileSync} from 'node:fs';
import path from 'node:path';
rmSync('dist',{recursive:true,force:true});mkdirSync('dist/server',{recursive:true});
const assets={};
function walk(dir,prefix=''){for(const f of readdirSync(dir,{withFileTypes:true})){const name=prefix+'/'+f.name;if(f.isDirectory())walk(path.join(dir,f.name),name);else if(/\.(html|css|js|json|webmanifest|svg)$/.test(name))assets[name]=readFileSync(path.join(dir,f.name),'utf8');}}
walk('public');
writeFileSync('dist/server/assets.js','export default '+JSON.stringify(assets)+';\n');
copyFileSync('server/api.mjs','dist/server/api.mjs');copyFileSync('server/worker.mjs','dist/server/index.js');
copyFileSync('server/lines.mjs','dist/server/lines.mjs');
console.log('Built worker and '+Object.keys(assets).length+' local assets.');
