{
  "generated_at": "2026-06-23T11:17:14.855723+00:00",
  "checks": [
    {
      "path": "/data",
      "exists": false,
      "is_dir": false
    },
    {
      "path": "/data/archive/personal-os-wiki/releases/8ade72d",
      "exists": false,
      "is_dir": false
    },
    {
      "cmd": "ssh -o BatchMode=yes -o ConnectTimeout=5 xingqiwu@192.168.6.37 true",
      "exit_code": 255,
      "output": "xingqiwu@192.168.6.37: Permission denied (publickey,password).\n"
    },
    {
      "cmd": "docker ps --format {{.Names}}",
      "exit_code": 1,
      "output": "Cannot connect to the Docker daemon at unix:///Users/xingqiwu/.orbstack/run/docker.sock. Is the docker daemon running?\n"
    }
  ]
}
