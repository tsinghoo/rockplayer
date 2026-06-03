import os
import subprocess
import sys

def main():
    # 切换到脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    account=""
    broker=""

    while True:
        # 清屏
        os.system('cls' if os.name == 'nt' else 'clear')
        
        user_input = os.environ.get('startGjzqqmt', '')

        if user_input == "":
            print("0. start gjzqqmt")
            print("q. quit")
            user_input = input("Please select: ")
            
        if user_input == "0":
            # 启动XtItClient.exe
            exe_path = r"c:\gjzqqmt\bin.x64\XtItClient.exe"
            try:
                subprocess.Popen(['start', exe_path], shell=True)
            except Exception as e:
                print(f"启动失败: {e}")
        elif user_input.lower() == "q":
            sys.exit(0)
        else:
            print("no start")
        

        user_input = os.environ.get('env', '')

        if user_input == "":
            print("1. wine")
            print("2. windows guoJin")
            print("3. windows huaXin")
            print("q. quit")
            
            user_input = input("Please select: ")
        
        if user_input == "1":
            qmtpath = r"c:\gjzqqmt\userdata_mini"
            account = "8883949249"  # 国金
            broker = "国金"
            configPathPrefix = r"c:"
            logPathPrefix = r"z:\data\logs"
            # 设置PATH环境变量
            python_path = r"z:\data\soft\pythonwin3.6.8"
            os.environ['PATH'] = python_path + os.pathsep + os.environ.get('PATH', '')
        elif user_input == "2":
            qmtpath = r"D:\国金证券QMT交易端\userdata_mini"

            account = "8883949249"  # 国金
            broker = "国金"

            configPathPrefix = "d:"
            logPathPrefix = "d:"
        elif user_input == "3":
            qmtpath = r"D:\huaXinQMT\userdata_mini"

            account = "50900001667601" #华鑫
            broker = "华鑫"

            configPathPrefix = "d:"
            logPathPrefix = "d:"
        elif user_input.lower() == "q":
            break
        else:
            continue
        
        user_input = os.environ.get('url', '')
        if user_input == "":
            print("1. http://152.136.244.225 vbj")
            print("2. http://test.labadida.com:3001")
            print("3. http://192.168.66.205:3001")
            print("4. http://10.2.20.3:3001 vbj local")
            print("q. quit")
            
            user_input = input("Please select: ")
        
        if user_input == "1":
            proxy = "http://152.136.244.225"
        elif user_input == "2":
            proxy = "http://test.labadida.com:3001"
        elif user_input == "3":
            proxy = "http://192.168.66.205:3001"
        elif user_input == "4":
            proxy = "http://10.2.20.3:3001"
        elif user_input.lower() == "q":
            break
        else:
            continue
        
        # 设置环境变量
        os.environ['qmtpath'] = qmtpath
        os.environ['configPathPrefix'] = configPathPrefix
        os.environ['logPathPrefix'] = logPathPrefix
        os.environ['proxy'] = proxy
        os.environ['account'] = account
        os.environ['broker'] = broker
        
        while True:
            print("1. qmt.mini.action.py")
            print("2. qmt.mini.data.py")
            print("3. qmt.mini.find.py")
            print("q. quit")
            
            user_input = input("Please select: ")
            
            if user_input == "1":
                try:
                    subprocess.run([sys.executable, "qmt.mini.action.py"], check=True)
                except subprocess.CalledProcessError as e:
                    print(f"脚本执行失败: {e}")
            elif user_input == "2":
                try:
                    subprocess.run([sys.executable, "qmt.mini.data.py"], check=True)
                except subprocess.CalledProcessError as e:
                    print(f"脚本执行失败: {e}")
            elif user_input == "3":
                try:
                    subprocess.run([sys.executable, "qmt.mini.find.py"], check=True)
                except subprocess.CalledProcessError as e:
                    print(f"脚本执行失败: {e}")
            elif user_input.lower() == "q":
                break
            else:
                continue
            
            # 执行完一个脚本后询问是否继续
            continue_script = input("是否继续执行其他脚本? (y/n): ")
            if continue_script.lower() != 'y':
                break
        
        # 询问是否重新开始整个流程
        restart = input("是否重新开始? (y/n): ")
        if restart.lower() != 'y':
            break

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n程序已退出")
    finally:
        input("按任意键退出...")
