"""
Server Actions - Execute maintenance tasks on servers
"""
import paramiko
import subprocess
from typing import Dict, List, Union
from datetime import datetime


class ServerActions:
    """Execute actions on remote servers"""
    
    ACTIONS = {
        "docker_cleanup": {
            "name": "Clean Up Docker",
            "description": "Remove unused images, containers, and build cache",
            "command": "docker system prune -af 2>&1",
            "dangerous": False
        },
        "docker_cleanup_full": {
            "name": "Deep Docker Cleanup",
            "description": "Remove ALL unused Docker data including volumes",
            "command": "docker system prune -af --volumes 2>&1",
            "dangerous": True
        },
        "clear_temp": {
            "name": "Clear Temp Files",
            "description": "Remove temporary files from /tmp",
            "command": "sudo rm -rf /tmp/* 2>&1 && echo 'Temp files cleared'",
            "dangerous": False
        },
        "clear_logs": {
            "name": "Rotate & Clear Old Logs",
            "description": "Clear log files older than 7 days",
            "command": "sudo find /var/log -type f -name '*.log' -mtime +7 -delete 2>&1 && echo 'Old logs cleared'",
            "dangerous": False
        },
        "restart_docker": {
            "name": "Restart Docker Service",
            "description": "Restart the Docker daemon (containers will restart)",
            "command": "sudo systemctl restart docker 2>&1 && echo 'Docker restarted'",
            "dangerous": True
        },
        "check_disk_usage": {
            "name": "Analyze Disk Usage",
            "description": "Show what's using the most disk space",
            "command": "du -sh /home/* /var/* /tmp 2>/dev/null | sort -rh | head -20",
            "dangerous": False
        },
        "list_large_files": {
            "name": "Find Large Files",
            "description": "List files larger than 100MB",
            "command": "find /home /var/www -type f -size +100M -exec ls -lh {} \\; 2>/dev/null | head -20",
            "dangerous": False
        },
        "memory_report": {
            "name": "Memory Usage Report",
            "description": "Show detailed memory usage by process",
            "command": "ps aux --sort=-%mem | head -15",
            "dangerous": False
        },
        "clear_docker_logs": {
            "name": "Clear Docker Container Logs",
            "description": "Truncate all Docker container log files",
            "command": "sudo sh -c 'truncate -s 0 /var/lib/docker/containers/*/*-json.log' 2>&1 && echo 'Docker logs cleared'",
            "dangerous": False
        }
    }
    
    def __init__(self, server_config: Dict):
        self.host = server_config["host"]
        self.port = server_config["port"]
        self.username = server_config["username"]
        self.password = server_config.get("password")
        self.key_path = server_config.get("key_path")
        self.server_name = server_config["name"]
        self.is_localhost = self.host in ["localhost", "127.0.0.1", "::1"]
    
    def _connect(self) -> Union[paramiko.SSHClient, None]:
        """Connect via SSH or return None for localhost"""
        if self.is_localhost:
            return None
        
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
    
    def execute_action(self, action_id: str) -> Dict:
        if action_id not in self.ACTIONS:
            return {"success": False, "error": f"Unknown action: {action_id}"}
        
        action = self.ACTIONS[action_id]
        
        try:
            if self.is_localhost:
                # Run command directly on localhost
                result = subprocess.run(
                    action["command"],
                    shell=True,
                    capture_output=True,
                    text=True,
                    timeout=120,
                    check=False
                )
                return {
                    "success": result.returncode == 0,
                    "action": action["name"],
                    "output": result.stdout,
                    "error": result.stderr if result.stderr else None,
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                # Run command via SSH
                client = self._connect()
                stdin, stdout, stderr = client.exec_command(action["command"], timeout=120)
                
                output = stdout.read().decode('utf-8')
                error = stderr.read().decode('utf-8')
                exit_code = stdout.channel.recv_exit_status()
                
                client.close()
                
                return {
                    "success": exit_code == 0,
                    "action": action["name"],
                    "output": output,
                    "error": error if error else None,
                    "timestamp": datetime.utcnow().isoformat()
                }
        except Exception as e:
            return {
                "success": False,
                "action": action["name"],
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    def get_suggestions(self, metrics: Dict) -> List[Dict]:
        suggestions = []
        
        disk_percent = metrics.get("disk", {}).get("percent", 0)
        if disk_percent > 90:
            suggestions.append({
                "severity": "critical",
                "title": "Critical: Disk Almost Full",
                "message": f"Disk is at {disk_percent}% - server may crash soon!",
                "actions": ["docker_cleanup_full", "clear_temp", "clear_logs", "clear_docker_logs"]
            })
        elif disk_percent > 75:
            suggestions.append({
                "severity": "warning",
                "title": "Disk Space Running Low",
                "message": f"Disk is at {disk_percent}% - consider cleaning up",
                "actions": ["docker_cleanup", "check_disk_usage", "list_large_files"]
            })
        
        mem_percent = metrics.get("memory", {}).get("percent", 0)
        if mem_percent > 90:
            suggestions.append({
                "severity": "critical",
                "title": "Critical: Memory Almost Full",
                "message": f"Memory is at {mem_percent}% - server may become unresponsive",
                "actions": ["memory_report", "restart_docker"]
            })
        elif mem_percent > 80:
            suggestions.append({
                "severity": "warning",
                "title": "High Memory Usage",
                "message": f"Memory is at {mem_percent}%",
                "actions": ["memory_report"]
            })
        
        return suggestions
    
    @classmethod
    def get_action_info(cls, action_id: str) -> Dict:
        if action_id in cls.ACTIONS:
            action = cls.ACTIONS[action_id]
            return {
                "id": action_id,
                "name": action["name"],
                "description": action["description"],
                "dangerous": action["dangerous"]
            }
        return None
    
    @classmethod
    def get_all_actions(cls) -> List[Dict]:
        return [
            {
                "id": action_id,
                "name": action["name"],
                "description": action["description"],
                "dangerous": action["dangerous"]
            }
            for action_id, action in cls.ACTIONS.items()
        ]


