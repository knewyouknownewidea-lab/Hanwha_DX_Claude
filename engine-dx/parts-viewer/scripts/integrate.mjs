import {spawnSync} from 'node:child_process';
import {cpSync,mkdirSync,existsSync} from 'node:fs';
import path from 'node:path';
const moduleRoot=path.resolve(import.meta.dirname,'..');
const engineDxRoot=path.resolve(moduleRoot,'..');
if(!existsSync(path.join(engineDxRoot,'app','Workspace.tsx')))throw new Error('Place this module at engine-dx/parts-viewer before integration.');
for(const script of ['export-models.mjs','build.mjs']){
 const result=spawnSync(process.execPath,[path.join(moduleRoot,'scripts',script)],{cwd:moduleRoot,stdio:'inherit'});
 if(result.status!==0)process.exit(result.status??1);
}
const destination=path.join(engineDxRoot,'public','parts-viewer');mkdirSync(destination,{recursive:true});
cpSync(path.join(moduleRoot,'dist'),destination,{recursive:true});
console.log('Integrated: engine-dx/public/parts-viewer/index.html');
