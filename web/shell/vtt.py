import os
import fileinput
import subprocess
import datetime
import sys
import re

# 指定目录路径
dir_path = "/flv"


def hasChinese(text):
    pattern = re.compile(r'[\u4e00-\u9fa5]')
    match = re.search(pattern, text)
    if match:
        return True
    else:
        return False


def log(content):
    # 获取当前时间
    current_time = datetime.datetime.now()

    # 格式化时间字符串，仅包含小时、分钟和秒
    now = current_time.strftime('%H:%M:%S')
    print(now, content)
    sys.stdout.flush()


def read_file(file_path):
    lines = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()  # 去除每行的首尾空格和换行符
            if line:  # 如果不是空行
                lines.append(line)
    return lines


def getScript(file_name):
    fn = os.path.splitext(file_name)[0]
    log("searching {}".format(fn))
    files = os.listdir(dir_path)
    res = None
    for file in files:
        if (fn in file):
            if (".vtt" in file):
                if (res is None):
                    res = file
                if ".zh" in file:
                    res = file
                if ".cn" in file:
                    res = file
    return res


def convertVtt(vtt):
    log("converting '{}'".format(vtt))
    lines = []
    timeFound = 0
    content = ""
    pat = r'^\d{2}:\d{2}:\d{2}'
    with open(os.path.join(dir_path, vtt)) as f:
        for line in f:
            line = line.strip()  # 去除每行的首尾空格和换行符
            m = re.match(pat, line)
            if m:
                timeFound = 1
                content = "{}\n <br>[{}]".format(content, line)
            elif timeFound == 1:
                content = "{} {}".format(content, line)

    return content


def genScript(file_name):
    # 检查是否是文件，检查文件是否是 .mp4 文件
    # if os.path.isfile("{}".format(os.path.join(dir_path, file_name))) :
    if os.path.isfile(os.path.join(dir_path, file_name)) and (file_name.endswith(".mp4") or file_name.endswith(".webm")):
        log(os.path.join(dir_path, file_name))
        name, extension = os.path.splitext(file_name)
        txtFileName = "{}.htm".format(file_name)
        txtFilePath = os.path.join(dir_path, txtFileName)
        filePath = os.path.join(dir_path, file_name)
        if os.path.exists(txtFilePath):
            skipped = 1
        else:
            script = getScript(file_name)
            if (script is not None):
                content = convertVtt(script)
                with open(txtFilePath, 'w') as f:
                    # 添加新的一行文本
                    f.write(
                        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head></html>\n")
                    #
                    f.write(content)


# 循环遍历目录中的每一个文件
for file_name in os.listdir(dir_path):
    genScript(file_name)
