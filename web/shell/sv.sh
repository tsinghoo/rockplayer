ps -ef|grep "app.js"|grep "node" |awk '{print $2}'|xargs kill -9 

cd ~/git/rockplayer/web/ 
nohup nodemon app.js 3001 /flv '.webm\;.mp4\;.mp3\;.m4a\;.ts\;.avi\;.pdf\;.docx\;.pptx' &
ps -ef|grep "app.js"|grep "node" |awk '{print $2}'
