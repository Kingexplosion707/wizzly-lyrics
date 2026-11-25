' Starts the Spicy Lyrics for Wizzly loader without a window (and Wizzly, if it isn't running).
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = dir
sh.Run "cmd /c node """ & dir & "\loader.js"" --start > """ & dir & "\loader.log"" 2>&1", 0, False
