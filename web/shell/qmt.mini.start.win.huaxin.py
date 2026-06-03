import os
import subprocess
import sys


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    target = os.path.join(script_dir, "qmt.mini.start.py")

    env = os.environ.copy()
    env["startGjzqqmt"] = "1"
    env["env"] = "3"
    env["url"] = "4"

    subprocess.run([sys.executable, target], check=True, cwd=script_dir, env=env)

if __name__ == "__main__":
    main()
