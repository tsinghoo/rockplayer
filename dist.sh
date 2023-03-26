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

read -t 2 -n 1 -p "nvm use v14.18.2(y/n):" input
if [ "$input" == "y" ]; then
  nvm use v14.18.2
fi



cd $DIR


dist="dev"
if [ "$1" == "prod" ]; then
  dist="prod"
  export CSC_IDENTITY_AUTO_DISCOVERY=false
fi
if [ "$dist" == "prod" ];then
  npm run bytenode
fi


npm run compile
cp -rf dist/main/*.js app/
cp -rf dist app/
cp -rf src app

npm run dist
#electron-builder --win --x64
