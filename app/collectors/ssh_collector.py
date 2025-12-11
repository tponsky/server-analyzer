import paramiko
from typing import Dict, Any

class SSHCollector:
    def __init__(self, server_config: Dict):
        self.host = server_config["host"]
        self.port = server_config["port"]
        self.username = server_config["username"]
        self.password = server_config.get("password")
        self.key_path = server_config.get("key_path")
        self.server_name = server_config["name"]
    
    def _connect(self) -> paramiko.SSHClient:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        connect_kwargs = {
            "hostname": self.host,
            "port": self.port,
            "username": self.username,
            "timeout": 30
        }
        
        if self.key_path:
            connect_kwargs["key_filename"] = self.key_path
        elif self.password:
            connect_kwargs["password"] = self.password
        
        client.connect(**connect_kwargs)
        return client
    
    def _run_command(self, client: paramiko.SSHClient, command: str) -> str:
        stdin, stdout, stderr = client.exec_command(command, timeout=30)
        return stdout.read().decode('utf-8').strip()
    
    def collect_all(self) -> Dict[str, Any]:
        try:
            client = self._connect()
            
            # CPU info
            cpu_percent = self._run_command(client, "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1")
            cpu_cores = self._run_command(client, "nproc")
            load_avg = self._run_command(client, "cat /proc/loadavg | awk '{print $1, $2, $3}'")
            
            # Memory info
            mem_info = self._run_command(client, "free -b | grep Mem")
            mem_parts = mem_info.split()
            mem_total = int(mem_parts[1]) if len(mem_parts) > 1 else 0
            mem_used = int(mem_parts[2]) if len(mem_parts) > 2 else 0
            mem_percent = (mem_used / mem_total * 100) if mem_total > 0 else 0
            
            # Disk info
            disk_info = self._run_command(client, "df -B1 / | tail -1")
            disk_parts = disk_info.split()
            disk_total = int(disk_parts[1]) if len(disk_parts) > 1 else 0
            disk_used = int(disk_parts[2]) if len(disk_parts) > 2 else 0
            disk_percent = int(disk_parts[4].replace('%', '')) if len(disk_parts) > 4 else 0
            
            # Uptime and hostname
            uptime = self._run_command(client, "uptime -p")
            hostname = self._run_command(client, "hostname")
            
            client.close()
            
            return {
                "status": "online",
                "cpu": {
                    "percent": float(cpu_percent) if cpu_percent else 0,
                    "cores": int(cpu_cores) if cpu_cores else 1,
                    "load_avg": load_avg
                },
                "memory": {
                    "total": mem_total,
                    "used": mem_used,
                    "percent": round(mem_percent, 1)
                },
                "disk": {
                    "total": disk_total,
                    "used": disk_used,
                    "percent": disk_percent
                },
                "uptime": uptime,
                "hostname": hostname
            }
        except Exception as e:
            return {
                "status": "offline",
                "error": str(e)
            }
    
    def get_processes(self, limit: int = 15) -> list:
        try:
            client = self._connect()
            output = self._run_command(client, f"ps aux --sort=-%mem | head -{limit}")
            client.close()
            
            lines = output.strip().split('\n')
            if len(lines) < 2:
                return []
            
            processes = []
            for line in lines[1:]:
                parts = line.split(None, 10)
                if len(parts) >= 11:
                    processes.append({
                        "user": parts[0],
                        "pid": parts[1],
                        "cpu": float(parts[2]),
                        "mem": float(parts[3]),
                        "command": parts[10][:50]
                    })
            return processes
        except Exception as e:
            return []

