// Windows ignores programmatic size changes on some non-resizable frameless windows.
// Unlock only for this synchronous operation; keep the user-facing window locked.
function setLockedWindowSize(win,width,height){
 const resizable=win.isResizable();
 try{if(!resizable)win.setResizable(true);win.setSize(width,height,false);}
 finally{if(!resizable)win.setResizable(false);}
 return win.getSize();
}
module.exports={setLockedWindowSize};
