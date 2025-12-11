import paramiko
from typing import Dict, Any

class DetailedAnalyzer:
    def __init__(self, server_config: Dict):
        self.host = server_config["host"]
        self.port = server_config["port"]
        self.username = server_config["username"]
        self.password = server_config.get("password")
        self.key_path = server_config.get("key_path")
    
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
        stdin, stdout, stderr = client.exec_command(command, timeout=60)
        return stdout.read().decode('utf-8').strip()
    
    def analyze(self) -> Dict[str, Any]:
        try:
            client = self._connect()
            
            # Disk usage by directory
            disk_by_dir = self._run_command(client, 
                "du -sh /home/* /var/* /tmp 2>/dev/null | sort -rh | head -15")
            
            # Docker system df
            docker_df = self._run_command(client, "docker system df -v 2>/dev/null")
            
            # Large files
            large_files = self._run_command(client,
                "find /home /var/www -type f -size +50M -exec ls -lh {} \\; 2>/dev/null | head -10")
            
            # Memory by process
            memory_procs = self._run_command(client,
                "ps aux --sort=-%mem | head -10")
            
            client.close()
            
            return {
                "disk_by_directory": disk_by_dir,
                "docker_disk": docker_df,
                "large_files": large_files,
                "memory_processes": memory_procs
            }
        except Exception as e:
            return {"error": str(e)}

