#/bin/bash
set -x

#to="-to 00:00:10"
cd $1

for file in *.avi; do 
  ffmpeg -i "$file" $to -c:v libx264 -crf 23 -c:a aac "$file.new.mp4" >> convert.log 2>&1
done


#ffmpeg -i "$1" -to 00:00:10 -vf scale=-1:480  -c:v libx264 -acodec copy -preset veryslow -crf 28 "$1.new.mp4"
