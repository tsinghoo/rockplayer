
stt(){
  today=`date +%Y-%m-%d`
  python /temp/stt.py  >> /temp/stt.$today.log 2>&1 
}

toexit=0
while [ "$toexit" == "0" ];do
  echo "run"
  stt
  sleep 10
done
echo "exit"
