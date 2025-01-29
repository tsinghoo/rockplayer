DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR
# in whisper env: 
# pip install rapid_videocr
# apt-get install libgl1
stt(){
  today=`date +%Y-%m-%d`
  python ./stt.py  >> ./stt.$today.log 2>&1 
}

stt

toexit=0
while [ "$toexit" == "0" ];do
  echo "run"
  stt
  sleep 10
done
echo "exit"
