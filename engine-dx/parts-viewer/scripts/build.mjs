import {cpSync,mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(import.meta.dirname,'..');
const threeRoot=path.resolve(path.dirname(fileURLToPath(import.meta.resolve('three'))),'..');
const dist=path.join(root,'dist');mkdirSync(dist,{recursive:true});
for(const file of ['index.html','favicon.svg','src','public','docs'])cpSync(path.join(root,file),path.join(dist,file),{recursive:true});
const vendor=path.join(dist,'vendor','three');mkdirSync(path.join(vendor,'addons','controls'),{recursive:true});mkdirSync(path.join(vendor,'addons','exporters'),{recursive:true});
for(const name of ['three.module.js','three.core.js'])cpSync(path.join(threeRoot,'build',name),path.join(vendor,name));
cpSync(path.join(threeRoot,'examples/jsm/controls/OrbitControls.js'),path.join(vendor,'addons/controls/OrbitControls.js'));
cpSync(path.join(threeRoot,'examples/jsm/exporters/GLTFExporter.js'),path.join(vendor,'addons/exporters/GLTFExporter.js'));
cpSync(path.join(threeRoot,'LICENSE'),path.join(vendor,'LICENSE'));
const manifestPath=path.join(root,'.openai/hosting.json');
if(existsSync(manifestPath)){const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));manifest.static={directory:'dist'};writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');}
console.log('Static viewer built: dist/ (local Three.js, no CDN requests)');
