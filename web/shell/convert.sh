#/bin/bash
set -x

#to="-to 00:00:10"
cd $1

for file in *.mpg; do 
  ffmpeg -i "$file" $to -vf scale=-1:480  -c:v libx264 -preset veryslow -crf 28 "$file.new.mp4"
done


#ffmpeg -i "$1" -to 00:00:10 -vf scale=-1:480  -c:v libx264 -acodec copy -preset veryslow -crf 28 "$1.new.mp4"
