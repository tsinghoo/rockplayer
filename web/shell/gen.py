import os
import subprocess
import fileinput
from urllib.parse import quote

# 指定目录路径
dir_path = "/flv"
indexFile="/flv/i.htm"
# 循环遍历目录中的每一个文件
with open(indexFile,'w') as f:
  f.write("<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head>\n") 
  for file_name in sorted(os.listdir(dir_path)):
    # 检查是否是文件，检查文件是否是 .mp4 文件
    if os.path.isfile(os.path.join(dir_path, file_name)) and (file_name.endswith(".mp4") or file_name.endswith(".webm")):
        f.write("<a href='./html/index.html?f={}'>{}</a>".format(quote(file_name), file_name)); 
        if os.path.isfile(os.path.join(dir_path, file_name+".htm")):
            f.write(" <span style='color:blue;'>&#x2663;</span> \n"); 
        f.write("<br><br>\n"); 
  f.write("</html>\n") 
