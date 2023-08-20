import os
import subprocess
import fileinput
import datetime


# 指定目录路径
dir_path = "/flv"

def log(content):
    # 获取当前时间
    current_time = datetime.datetime.now()

    # 格式化时间字符串，仅包含小时、分钟和秒
    now = current_time.strftime('%H:%M:%S')
    print(now,content)



# 循环遍历目录中的每一个文件
for file_name in os.listdir(dir_path):
    if os.path.isfile(os.path.join(dir_path, file_name)) and file_name.endswith(".htm"):
        name, extension = os.path.splitext(file_name)
        txtFileName = "{}.mp4.htm".format(name)
        command="mv '/flv/{}' '/flv/{}'".format(file_name, txtFileName);
        log(command);
        subprocess.call(command, shell=True)
