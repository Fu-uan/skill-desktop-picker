param([ValidateSet('foreground','paste')][string]$Action='foreground',[long]$Handle=0)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class NativeWindow {
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int max);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
}
'@
if($Action -eq 'foreground') {
 $targetHandle=[NativeWindow]::GetForegroundWindow()
 $titleBuffer=New-Object System.Text.StringBuilder 512
 [void][NativeWindow]::GetWindowText($targetHandle,$titleBuffer,512)
 [uint32]$targetPid=0
 [void][NativeWindow]::GetWindowThreadProcessId($targetHandle,[ref]$targetPid)
 @{handle=$targetHandle.ToInt64();title=$titleBuffer.ToString();pid=$targetPid} | ConvertTo-Json -Compress
} else {
 if(-not [NativeWindow]::IsWindow([IntPtr]$Handle)){throw '目标窗口已关闭'}
 if(-not [NativeWindow]::SetForegroundWindow([IntPtr]$Handle)){throw '无法激活目标窗口，请手动粘贴'}
 Start-Sleep -Milliseconds 180
 if([NativeWindow]::GetForegroundWindow().ToInt64() -ne $Handle){throw '焦点发生变化，已取消插入'}
 Add-Type -AssemblyName System.Windows.Forms
 [System.Windows.Forms.SendKeys]::SendWait('^v')
 # Never send Enter. The user reviews and sends the draft.
}
