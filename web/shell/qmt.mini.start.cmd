@echo off
cd /d "%~dp0"
:begin
cls
@echo start

set PATH=z:\data\soft\pythonwin3.6.8\;%PATH%
@echo PATH=%PATH%

python .\qmt.mini.start.py 

@echo end
pause
