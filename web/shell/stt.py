import os
import fileinput
import subprocess
import datetime
import sys
import re
import json
import shutil


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


def getVtt(vfp):
    # 获取文件所在目录和文件名
    dir_path, file_name = os.path.split(vfp)
    # 生成与输入文件相同的前缀（去掉 .mp4 后缀）
    base_name = os.path.splitext(file_name)[0]

    # 遍历目录查找匹配的 .vtt 文件
    for file in os.listdir(dir_path):
        if file.startswith(base_name) and file.endswith('.vtt') and file[base_name.rfind('.')+1:].startswith('zh'):
            return file
    return None


def vtt2htm(fp):
    # 获取文件名的基础部分（去掉扩展名）
    log("vtt2htm")
    base_filename = fp.rsplit('.', 1)[0]
    base_filename = base_filename.rsplit('.', 1)[0]
    output_filename = base_filename + '.htm'

    with open(fp, 'r', encoding='utf-8') as file:
        lines = file.readlines()

    result = []
    timestamp = ''
    text = []

    for line in lines:
        line = line.strip()

        # 时间戳行
        if '-->' in line:
            # 如果之前有字幕内容，拼接它
            if text:
                result.append(f"<br>[{timestamp}] {''.join(text)}")
                text = []  # 清空文本，准备下一段字幕
            timestamp = line  # 保存当前时间戳

        # 字幕内容
        elif line and not line.startswith('NOTE') and not line.startswith('WEBVTT'):
            text.append(line)

    # 最后一段字幕也需要添加
    if text:
        result.append(f"<br>[{timestamp}] {''.join(text)}")

    # 将结果写入到 HTML 文件
    with open(output_filename, 'w', encoding='utf-8') as out_file:
        out_file.write(
            "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head></html>\n")

        for line in result:
            out_file.write(f'{line}\n')


def srt2htm(fp):
    log("srt2htm")
    # 打开原始的 .srt 文件
    with open(fp, 'r', encoding='utf-8') as srt_file:
        # 读取文件内容
        lines = srt_file.readlines()

    # 存储合并后的字幕内容
    subtitle_html = []

    # 定义用于匹配字幕的时间戳的正则表达式
    time_pattern = r'(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})'

    # 逐行处理文件内容
    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # 如果是字幕时间戳
        time_match = re.match(time_pattern, line)
        if time_match:
            # 获取开始和结束时间
            start_time, end_time = time_match.groups()
            subtitle_content = ''

            # 获取该时间戳下的所有字幕内容
            i += 1
            while i < len(lines) and lines[i].strip() != '':
                subtitle_content += lines[i].strip() + ' '
                i += 1

            # 拼接时间和字幕内容，并添加到列表中
            subtitle_html.append(
                f'<br>[{start_time} --> {end_time}] {subtitle_content.strip()}')
        else:
            i += 1

    # 将结果写入同名的 .htm 文件
    html_fp = fp.rsplit('.', 1)[0] + '.htm'
    with open(html_fp, 'w', encoding='utf-8') as html_file:
        html_file.write(
            "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head></html>\n")
        for subtitle in subtitle_html:
            html_file.write(subtitle + '\n')


def hasScript(str, fileName):
    log("hasScript")
    try:
        # 将json字符串转换为字典
        data = json.loads(str)

        log("json loaded")
        # 检查是否存在键 "脚本" 且其值为列表
        if "script" in data:
            log("脚本存在")
            if (fileName in data["script"]):
                return True
            else:
                return False
        else:
            log("脚本不存在")
    except json.JSONDecodeError:
        log("json decode error")
        return False
    return False
# 循环遍历目录中的每一个文件
# for file_name in os.listdir(dir_path):


def genScript(file_name):
    # 检查是否是文件，检查文件是否是 .mp4 文件
    # if os.path.isfile("{}".format(os.path.join(dir_path, file_name))) :
    if os.path.isfile(os.path.join(dir_path, file_name)) and (file_name.endswith(".mp4") or file_name.endswith(".mp3") or file_name.endswith(".m4a") or file_name.endswith(".webm")):
        log(os.path.join(dir_path, file_name))
        name, extension = os.path.splitext(file_name)
        txtFileName = "{}.htm".format(file_name)
        srtFileName = "{}.srt".format(file_name)
        txtFilePath = os.path.join(dir_path, txtFileName)
        srtFilePath = os.path.join(dir_path, srtFileName)
        filePath = os.path.join(dir_path, file_name)
        if os.path.exists(txtFilePath):
            log("skipped")
        else:
            try:
                vttFile = getVtt(file_name)
                if vttFile != None:
                    vtt2htm(vttFile)
                elif os.path.exists(srtFilePath):
                    srt2htm(srtFilePath)
                else:
                    with open(os.path.join(dir_path, "tags"), 'r', encoding='utf-8') as file:
                        tags = file.read()
                        log(tags)
                        if (hasScript(tags, file_name)):
                            command = "VideoSubFinderCli.run -c -r -i \"{}\" -te 0.3 -be 0.05 -le 0.1 -re 0.9 -o \"{}\"".format(filePath.replace(
                                "\"", "\\\""), dir_path)
                            log(command)
                            subprocess.call(command, shell=True)
                            log("done")
                            command = "rapid_videocr -i \"{}/RGBImages\" -s \"{}\" ".format(
                                dir_path, dir_path)
                            log(command)
                            subprocess.call(command, shell=True)
                            log("done")
                            log("move {}/result.srt to {}/{}.srt".format(dir_path,
                                dir_path, file_name))
                            shutil.move("{}/result.srt".format(dir_path),
                                        "{}/{}.srt".format(dir_path, file_name))

                            srt2htm(srtFilePath)
                        else:
                            command = "whisper \"{}\" --output_dir \"{}\"  > \"{}\"".format(filePath.replace(
                                "\"", "\\\""), dir_path, txtFilePath.replace("\"", "\\\"'")+".tmp")
                            if (hasChinese(file_name)):
                                command = "whisper \"{}\" --output_dir \"{}\" --language Chinese > \"{}\"".format(
                                    filePath.replace("\"", "\\\""), dir_path, txtFilePath.replace("\"", "\\\"'")+".tmp")
                            log(command)
                            subprocess.call(command, shell=True)
                            log("done")
                            with fileinput.input(txtFilePath+".tmp", inplace=True, backup=".bak") as file:
                                # 遍历文件中的每一行
                                for line in file:
                                    # 输出每一行（因为 inplace=True，所以输出的结果将写入文件中）
                                    print("{} <br>".format(line), end="")

                            with open(txtFilePath+".tmp") as f:
                                content = f.read()
                                with open(txtFilePath, 'w') as f:
                                    # 添加新的一行文本
                                    f.write(
                                        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head></html>\n")
                                    # 将原始内容写回文件中
                                    f.write(content)
            except Exception as e:
                log("error")


with open('/flv/todo') as f:
    # 每次从文件中读取一行并打印
    for line in f:
        file_name = line.rstrip()
        genScript(file_name)

log("finished")
