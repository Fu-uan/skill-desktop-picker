const {app,net}=require('electron');
const {createImporter}=require('../src/github-import.cjs');
const {archiveSnapshot}=require('../src/github-archive.cjs');
app.whenReady().then(async()=>{
 const download=(url,options)=>net.fetch(url,options);
 const importer=createImporter(download,source=>archiveSnapshot(source,download,{onProgress:text=>console.log(text)}),{archiveFirst:true});
 try{const start=Date.now();const preview=await importer.preview('https://github.com/Adkid-Zephyr/anti-defensive-writing-Skill');const skill=await importer.inspect(preview.token,preview.skills[0].path);const elapsed=Date.now()-start;const cached=Date.now();await importer.preview('https://github.com/Adkid-Zephyr/anti-defensive-writing-Skill');console.log(JSON.stringify({passed:true,elapsedMs:elapsed,cachedMs:Date.now()-cached,name:skill.name,skills:preview.skills.length,transport:preview.transport}));await importer.dispose();app.quit();}
 catch(error){console.error(error.message);await importer.dispose();app.exit(1);}
});
