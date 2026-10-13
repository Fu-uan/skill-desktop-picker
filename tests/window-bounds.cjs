const {app,BrowserWindow}=require('electron');
const assert=require('node:assert/strict');
const {setLockedWindowSize}=require('../src/window-size.cjs');
app.whenReady().then(async()=>{
 const win=new BrowserWindow({width:470,height:740,frame:false,transparent:true,resizable:false,show:false});
 try{for(const zoom of [.9,1,1.1,1.25,1.5])for(const height of [500,76,500,76]){
 const width=Math.round(470*zoom),requestedHeight=Math.round(height*zoom);
 setLockedWindowSize(win,width,requestedHeight);
 await new Promise(resolve=>setTimeout(resolve,30));
 const actual=win.getSize();
 assert.ok(Math.abs(actual[0]-width)<=2&&Math.abs(actual[1]-requestedHeight)<=2,JSON.stringify({zoom,requested:[width,requestedHeight],actual}));
 assert.equal(win.isResizable(),false);
 }console.log(JSON.stringify({passed:true,transitions:20,zoomLevels:5,dpiRoundingTolerance:2}));app.quit();}
 catch(error){console.error(error.message);app.exit(1);}
});
