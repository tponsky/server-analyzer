#!/bin/bash
# Script to update the OpenAI API key on the AWS EC2 server

if [ -z "$1" ]; then
    echo "Usage: ./update_api_key.sh <new_api_key>"
    echo ""
    echo "To get a new API key:"
    echo "1. Go to https://platform.openai.com/api-keys"
    echo "2. Click '+ Create new secret key'"
    echo "3. Copy the key (you'll only see it once!)"
    echo "4. Run: ./update_api_key.sh <your_new_key>"
    exit 1
fi

NEW_KEY="$1"
SERVER="ec2-user@3.14.156.143"
KEY_FILE="$HOME/Desktop/Cursor Projects/AWS/EmpowerAI.pem"

echo "Updating OpenAI API key on server..."
echo ""

# Update the systemd service file
ssh -i "$KEY_FILE" "$SERVER" << EOF
    # Backup the current service file
    sudo cp /etc/systemd/system/server-analyzer.service /etc/systemd/system/server-analyzer.service.backup
    
    # Update the API key in the service file
    sudo sed -i "s|Environment=\"OPENAI_API_KEY=.*\"|Environment=\"OPENAI_API_KEY=$NEW_KEY\"|" /etc/systemd/system/server-analyzer.service
    
    # Reload systemd and restart the service
    sudo systemctl daemon-reload
    sudo systemctl restart server-analyzer
    
    # Verify it's running
    sleep 2
    sudo systemctl status server-analyzer --no-pager | head -10
EOF

echo ""
echo "✅ API key updated and service restarted!"
echo ""
echo "To verify it's working, try running an analysis in the web app."

