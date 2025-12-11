import paramiko
from typing import Dict, Any, List

class DockerCollector:
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
        stdin, stdout, stderr = client.exec_command(command, timeout=30)
        return stdout.read().decode('utf-8').strip()
    
    def get_containers(self) -> Dict[str, Any]:
        try:
            client = self._connect()
            
            # Get container counts
            running = self._run_command(client, "docker ps -q | wc -l")
            total = self._run_command(client, "docker ps -aq | wc -l")
            
            # Get container details
            containers_output = self._run_command(client, 
                "docker ps --format '{{.Names}}|{{.Status}}|{{.Image}}'")
            
            containers = []
            if containers_output:
                for line in containers_output.split('\n'):
                    parts = line.split('|')
                    if len(parts) >= 3:
                        containers.append({
                            "name": parts[0],
                            "status": parts[1],
                            "image": parts[2]
                        })
            
            # Get Docker disk usage
            disk_usage = self._run_command(client, "docker system df --format '{{.Type}}: {{.Size}}'")
            
            client.close()
            
            return {
                "running": int(running) if running else 0,
                "total": int(total) if total else 0,
                "containers": containers,
                "disk_usage": disk_usage
            }
        except Exception as e:
            return {
                "running": 0,
                "total": 0,
                "containers": [],
                "error": str(e)
            }

