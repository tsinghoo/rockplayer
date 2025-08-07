@echo off
cd /d "%~dp0"
:begin
cls


echo 1. http://test1.91taogu.com
echo 2. http://192.168.66.205:3001
echo q. quit

set /p "input=Please select: "

if %input%==1 ( 
  proxy=http://test1.91taogu.com
  pause
) else if %input%==2 (
  proxy=http://192.168.66.205:3001
  pause
) else if %input%==q ( 
  echo quit
) else ( 
  goto begin
)


echo 1. qmt.mini.py
echo 2. qmt.mini.find.py
echo q. quit

set /p "input=Please select: "

if %input%==1 ( 
  python .\qmt.mini.py 
  pause
) else if %input%==2 ( 
  python .\qmt.mini.find.py 
  pause
) else if %input%==q ( 
  echo quit
) else ( 
  goto begin
)


