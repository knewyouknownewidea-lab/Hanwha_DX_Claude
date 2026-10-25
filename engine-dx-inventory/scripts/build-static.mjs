import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
for(const script of ['export-parts.mjs','build-local.mjs']){
  const result=spawnSync(process.execPath,[path.join(root,'scripts',script)],{cwd:root,stdio:'inherit',env:{...process.env,INTEGRATED_BUILD_DIR:'dist'}});
  if(result.status!==0)process.exit(result.status??1);
}
