@echo off
cd /d "%~dp0"
:begin
cls

echo 0. start gjzqqmt
echo q. quit
set /p "input=Please select: "
if "%input%"=="0" (
  start z:\data\soft\gjzqqmt\bin.x64\XtItClient.exe
) else ( 
  echo no start
)

echo 1. wine
echo 2. windows
echo q. quit

set /p "input=Please select: "

if "%input%"=="1" (
  set qmtpath=z:\data\soft\gjzqqmt\userdata_mini
  set configPathPrefix=z:\data\noDel
  set logPathPrefix=z:\data\logs
  set PATH="z:\data\soft\pythonwin3.6.8\;%PATH%"
) else if "%input%"=="2" (
  set qmtpath=D:\国金证券QMT交易端\userdata_mini
  set configPathPrefix=d:
  set logPathPrefix=d:
) else ( 
  goto exit
)

echo 1. https://vbj.labadida.com
echo 2. http://test1.91taogu.com
echo 3. http://192.168.66.205:3001
echo q. quit

set /p "input=Please select: "

if "%input%"=="1" ( 
  set proxy=https://vbj.labadida.com
) else if "%input%"=="2" (
  set proxy=http://test1.91taogu.com
) else if "%input%"=="3" (
  set proxy=http://192.168.66.205:3001
) else ( 
  goto exit
) 


:script
echo 1. qmt.mini.py
echo 2. qmt.mini.find.py
echo q. quit

set /p "input=Please select: "

if "%input%"=="1" ( 
  python .\qmt.mini.py 
) else if "%input%"=="2" ( 
  python .\qmt.mini.find.py
) else ( 
  goto exit
)

:exit
pause

