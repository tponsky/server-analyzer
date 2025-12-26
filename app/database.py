import sqlite3
import os
from datetime import datetime
from typing import List, Dict

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'metrics.db')

class Database:
    def __init__(self):
        self.db_path = DB_PATH
        self._init_db()
    
    def _init_db(self):
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                cpu_percent REAL,
                memory_percent REAL,
                disk_percent REAL
            )
        ''')
        conn.commit()
        conn.close()
    
    def save_metrics(self, server_id: str, cpu: float, memory: float, disk: float):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO metrics (server_id, cpu_percent, memory_percent, disk_percent)
            VALUES (?, ?, ?, ?)
        ''', (server_id, cpu, memory, disk))
        conn.commit()
        conn.close()
    
    def get_history(self, server_id: str, hours: int = 24) -> List[Dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT timestamp, cpu_percent, memory_percent, disk_percent
            FROM metrics
            WHERE server_id = ?
            AND timestamp > datetime('now', ?)
            ORDER BY timestamp ASC
        ''', (server_id, f'-{hours} hours'))
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {
                "timestamp": row[0],
                "cpu": row[1],
                "memory": row[2],
                "disk": row[3]
            }
            for row in rows
        ]



