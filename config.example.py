"""
Example configuration file.
Copy this to config.py and fill in your credentials.
Or set environment variables as shown below.
"""
import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'a_very_secret_key'

# Server configurations
SERVERS = {
    "godaddy": {
        "name": "GoDaddy VPS",
        "host": os.environ.get("GODADDY_HOST", "YOUR_IP_HERE"),
        "port": 22,
        "username": os.environ.get("GODADDY_USER", "your_username"),
        "password": os.environ.get("GODADDY_PASSWORD", "your_password"),
        "type": "vps"
    },
    "aws": {
        "name": "AWS EC2",
        "host": "localhost",  # Use localhost when running on the EC2 instance
        "port": 22,
        "username": "ec2-user",
        "key_path": "/home/ec2-user/.ssh/id_rsa",
        "type": "ec2"
    }
}

# OpenAI API Key
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "your_openai_api_key")

# AWS credentials for Cost Explorer (optional)
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY")

