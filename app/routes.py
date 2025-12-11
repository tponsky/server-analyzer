from flask import Blueprint, render_template, jsonify, request
from app.collectors.ssh_collector import SSHCollector
from app.collectors.docker_collector import DockerCollector
from app.collectors.detailed_analyzer import DetailedAnalyzer
from app.ai_assistant import ServerAssistant
from app.actions import ServerActions
from app.database import Database
from config import SERVERS
import traceback

main_bp = Blueprint('main', __name__)
api_bp = Blueprint('api', __name__)

db = Database()
ai_assistant = ServerAssistant()

@main_bp.route('/')
def dashboard():
    return render_template('dashboard.html', servers=SERVERS)

@api_bp.route('/servers')
def list_servers():
    return jsonify({
        server_id: {"name": config["name"], "host": config["host"]}
        for server_id, config in SERVERS.items()
    })

@api_bp.route('/metrics/<server_id>')
def get_metrics(server_id):
    if server_id not in SERVERS:
        return jsonify({"error": "Server not found"}), 404
    
    server = SERVERS[server_id]
    collector = SSHCollector(server)
    metrics = collector.collect_all()
    
    if metrics.get("status") == "online":
        db.save_metrics(
            server_id,
            metrics.get("cpu", {}).get("percent", 0),
            metrics.get("memory", {}).get("percent", 0),
            metrics.get("disk", {}).get("percent", 0)
        )
    
    return jsonify(metrics)

@api_bp.route('/processes/<server_id>')
def get_processes(server_id):
    if server_id not in SERVERS:
        return jsonify({"error": "Server not found"}), 404
    
    server = SERVERS[server_id]
    collector = SSHCollector(server)
    processes = collector.get_processes()
    return jsonify({"processes": processes})

@api_bp.route('/docker/<server_id>')
def get_docker(server_id):
    if server_id not in SERVERS:
        return jsonify({"error": "Server not found"}), 404
    
    server = SERVERS[server_id]
    collector = DockerCollector(server)
    docker_info = collector.get_containers()
    return jsonify(docker_info)

@api_bp.route('/history/<server_id>')
def get_history(server_id):
    hours = request.args.get('hours', 24, type=int)
    history = db.get_history(server_id, hours)
    return jsonify({"history": history})

@api_bp.route('/analyze/<server_id>')
def deep_analyze(server_id):
    if server_id not in SERVERS:
        return jsonify({"error": "Server not found"}), 404
    
    server = SERVERS[server_id]
    analyzer = DetailedAnalyzer(server)
    analysis = analyzer.analyze()
    return jsonify(analysis)

@api_bp.route('/chat/<server_id>', methods=['POST'])
def chat(server_id):
    if server_id not in SERVERS:
        return jsonify({"error": "Server not found"}), 404
    
    data = request.get_json()
    question = data.get("question", "")
    
    if not question:
        return jsonify({"error": "No question provided"}), 400
    
    server = SERVERS[server_id]
    
    try:
        collector = SSHCollector(server)
        metrics = collector.collect_all()
        processes = collector.get_processes()
        
        docker_collector = DockerCollector(server)
        docker_info = docker_collector.get_containers()
        
        server_data = {
            "metrics": metrics,
            "top_processes": processes[:5],
            "docker": docker_info
        }
        
        response = ai_assistant.analyze(question, server_data)
        return jsonify({"response": response})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@api_bp.route('/suggestions/<server_id>')
def get_suggestions(server_id):
    if server_id not in SERVERS:
        return jsonify({"error": "Server not found"}), 404
    
    server = SERVERS[server_id]
    
    try:
        collector = SSHCollector(server)
        metrics = collector.collect_all()
        
        actions = ServerActions(server)
        suggestions = actions.get_suggestions(metrics)
        
        for suggestion in suggestions:
            suggestion["action_details"] = [
                ServerActions.get_action_info(action_id)
                for action_id in suggestion.get("actions", [])
            ]
        
        return jsonify({
            "suggestions": suggestions,
            "metrics_summary": {
                "cpu": metrics.get("cpu", {}).get("percent", 0),
                "memory": metrics.get("memory", {}).get("percent", 0),
                "disk": metrics.get("disk", {}).get("percent", 0)
            }
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e), "suggestions": []}), 500

@api_bp.route('/actions')
def list_actions():
    return jsonify({"actions": ServerActions.get_all_actions()})

@api_bp.route('/actions/<server_id>/<action_id>', methods=['POST'])
def execute_action(server_id, action_id):
    if server_id not in SERVERS:
        return jsonify({"error": "Server not found"}), 404
    
    server = SERVERS[server_id]
    actions = ServerActions(server)
    
    action_info = ServerActions.get_action_info(action_id)
    if not action_info:
        return jsonify({"error": f"Unknown action: {action_id}"}), 404
    
    try:
        result = actions.execute_action(action_id)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

