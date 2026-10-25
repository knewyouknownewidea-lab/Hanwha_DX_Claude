import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
export async function writeDependencyNotices(root,output,inputs){
  const packages=new Map();
  for(const input of inputs){
    if(!input.includes('node_modules'))continue;
    let directory=path.dirname(path.resolve(root,input));
    for(let depth=0;depth<12;depth++){
      try{const pkg=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'));
        if(pkg.name){if(!packages.has(pkg.name))packages.set(pkg.name,{directory,pkg});break;}
      }catch{}
      const parent=path.dirname(directory);if(parent===directory)break;directory=parent;
    }
  }
  const blocks=['Third-party dependency notices for this browser build.\nOriginal project code and concept geometry retain their existing rights.\nReference photos, CAD candidates and official PDFs are not redistributed.'];
  for(const [name,{directory,pkg}] of [...packages].sort(([a],[b])=>a.localeCompare(b))){
    const names=(await readdir(directory)).filter(file=>/^(license|licence|copying|notice)(\.|$)/i.test(file));
    const texts=[];for(const file of names){try{texts.push(file+'\n'+await readFile(path.join(directory,file),'utf8'));}catch{}}
    blocks.push(`${name} ${pkg.version??''}\nDeclared license: ${typeof pkg.license==='string'?pkg.license:JSON.stringify(pkg.license??'See package sources')}\n${texts.join('\n\n')||'License/copyright comments are retained in the emitted module source.'}`);
  }
  await writeFile(path.join(output,'THIRD_PARTY_NOTICES.txt'),blocks.join('\n\n'+'='.repeat(72)+'\n\n'),'utf8');
}
