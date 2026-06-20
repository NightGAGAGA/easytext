Set WshShell = CreateObject("WScript.Shell")
Dim currentDir
currentDir = WshShell.CurrentDirectory
WshShell.Run "node """ & currentDir & "\server.cjs"""", 0, False
WshShell.Run "explorer """"http://localhost:8080""""", 0, False
