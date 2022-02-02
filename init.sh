#!/bin/bash
now=`date +%Y.%m.%d.%H:%M`
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

pause(){
  echo 
  echo $1 
  read -t 3 -n 1 -p "press CTRL+C to quit" reply
  echo 
  echo 
}


export ELECTRON_MIRROR="https://cdn.npm.taobao.org/dist/electron/"

npm install @ffmpeg-installer/win32-x64 --force

#tmp.node is not a valid Win32 application
cd app

npm install @ffmpeg-installer/win32-x64 --force

#logcat用$android-sdk/tools/monitor
#wsl中的adb不能直接用，需要用win10的adb.exe
