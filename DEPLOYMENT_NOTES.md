# Server Analyzer - Deployment Notes

## Overview
A web dashboard to monitor GoDaddy and AWS servers with AI-powered insights and one-click fixes.

## Last Updated
December 11, 2025

## What Was Done (Dec 11, 2025)

### Features Built
1. **Dashboard** - Real-time CPU, memory, disk monitoring
2. **Process Viewer** - See running processes sorted by memory
3. **Docker Monitor** - View running containers
4. **History Charts** - Track metrics over time
5. **Deep Analysis** - Detailed disk and Docker usage analysis
6. **AI Assistant** - Ask questions about server health (uses OpenAI)
7. **Smart Actions** - One-click fixes for common issues:
   - Clean Up Docker
   - Deep Docker Cleanup
   - Clear Temp Files
   - Rotate & Clear Old Logs
   - Restart Docker Service
   - Analyze Disk Usage
   - Find Large Files
   - Memory Usage Report
   - Clear Docker Container Logs

### Deployed To
- **URL**: https://serveranalyzer.staycurrentai.com
- **Server**: AWS EC2 (3.14.156.143)
- **Port**: 8050 (proxied through Apache)
- **Service**: systemd `server-analyzer.service`

### Files Structure
```
Server analyzer/
├── app/
│   ├── __init__.py          # Flask app factory
│   ├── routes.py             # API endpoints
│   ├── database.py           # SQLite for metrics history
│   ├── ai_assistant.py       # OpenAI integration
│   ├── actions.py            # Smart Actions (one-click fixes)
│   └── collectors/
│       ├── ssh_collector.py      # SSH metrics collection
│       ├── docker_collector.py   # Docker stats
│       └── detailed_analyzer.py  # Deep analysis
├── templates/
│   └── dashboard.html        # Frontend UI
├── static/
│   ├── css/dashboard.css     # Styles
│   └── js/dashboard.js       # Frontend logic
├── config.py                 # Server credentials
├── run.py                    # Development server
└── requirements.txt          # Python dependencies
```

### To Redeploy
```bash
# Upload files to AWS
scp -i ~/Desktop/Cursor\ Projects/AWS/EmpowerAI.pem -r app templates static config.py run.py ec2-user@3.14.156.143:~/server-analyzer/

# Restart service
ssh -i ~/Desktop/Cursor\ Projects/AWS/EmpowerAI.pem ec2-user@3.14.156.143 "sudo systemctl restart server-analyzer"
```

### Server Credentials
- See `/Users/toddponskymd/Desktop/Cursor Projects/Credentials/Vibe Coding Credentials.rtf`



