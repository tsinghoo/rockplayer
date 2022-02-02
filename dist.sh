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

exe(){
	local pwd=`pwd`
	echo $pwd\$ $1
	`$1`
}


cd $DIR
npm run compile
cp -rf dist/main/*.js app/
cp -rf src app
dist="dist"
if [ "$1" == "mac" ]; then
  dist="distmac"
  export CSC_IDENTITY_AUTO_DISCOVERY=false
fi

npm run $dist
#electron-builder --win --x64
