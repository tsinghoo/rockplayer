import os
import fileinput
import subprocess
import datetime
import re

# 指定目录路径
dir_path = "/flv"

def log(content):
    # 获取当前时间
    current_time = datetime.datetime.now()

    # 格式化时间字符串，仅包含小时、分钟和秒
    now = current_time.strftime('%H:%M:%S')
    print(now,content)


# 循环遍历目录中的每一个文件
#for file_name in os.listdir(dir_path):
with open(dir_path + '/tosplit') as f:
    # 每次从文件中读取一行并打印
    for line in f:
      line=line.rstrip()
      lst=re.split("[,]",line)
      src=os.path.join(dir_path, lst[0])
      start=lst[1]
      end=lst[2]
      target=os.path.join(dir_path, lst[3])
      #检查是否是文件，检查文件是否是 .mp4 文件
      #if os.path.isfile("{}".format(os.path.join(dir_path, file_name))) :
      if os.path.exists(src):
        if os.path.exists(os.path.join(dir_path, target)):
            log(target + " skipped")
        else:
            log(target + "creating")
            command="ffmpeg -i '{}' -ss {} -to {} {}".format(src, start, end, target);
            log(command);
            subprocess.call(command, shell=True)
            log(target + "created")
      else:
        log(file_name+" not exist")
