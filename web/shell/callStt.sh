DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

stt(){
  today=`date +%Y-%m-%d`
  python ./stt.py  >> ./stt.$today.log 2>&1 
}

toexit=0
while [ "$toexit" == "0" ];do
  echo "run"
  stt
  sleep 10
done
echo "exit"
