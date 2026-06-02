@echo off
cd /d "%~dp0"
:begin
cls
@echo start

set PATH=z:\data\soft\pythonwin3.6.8\;%PATH%
@echo PATH=%PATH%
set startGjzqqmt=
set env=1
set url=4


python .\qmt.mini.start.py 

@echo end
pause
