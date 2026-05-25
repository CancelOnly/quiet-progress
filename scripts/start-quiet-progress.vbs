Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

ProjectPath = FSO.GetParentFolderName(FSO.GetParentFolderName(WScript.ScriptFullName))
Command = "cmd /c cd /d """ & ProjectPath & """ && npm start"

WshShell.Run Command, 0, False