from openai import OpenAI
from config import OPENAI_API_KEY
from typing import Dict, List
import json

class ServerAssistant:
    def __init__(self):
        self.client = OpenAI(api_key=OPENAI_API_KEY)
    
    def analyze(self, question: str, server_data: Dict) -> Dict:
        """
        Analyze server data and return structured recommendations with risk levels.
        Returns a dict with 'summary', 'recommendations', and 'upgrade_suggestion'.
        """
        system_prompt = """You are a friendly server assistant helping non-technical users. 
When analyzing server issues, provide:
1. A brief summary in plain language
2. Actionable recommendations with risk levels:
   - GREEN: Safe to do, low risk, recommended
   - YELLOW: Consider carefully, explain what could happen in simple terms
   - RED: High risk, only if necessary, explain risks clearly
3. Server upgrade suggestions if resources are consistently high

Available actions you can reference (use action_id if it matches):
- docker_cleanup: Clean up unused Docker images/containers (GREEN)
- docker_cleanup_full: Deep Docker cleanup including volumes (YELLOW)
- clear_temp: Clear temporary files (GREEN)
- clear_logs: Clear old log files (GREEN)
- clear_docker_logs: Clear Docker container logs (GREEN)
- check_disk_usage: Analyze what's using disk space (GREEN)
- list_large_files: Find large files (GREEN)
- memory_report: Show memory usage report (GREEN)
- restart_docker: Restart Docker service (RED)

Format your response as JSON with this structure:
{
  "summary": "Brief explanation in plain language",
  "recommendations": [
    {
      "title": "What to do",
      "description": "Simple explanation of what this does",
      "risk": "GREEN|YELLOW|RED",
      "considerations": "For YELLOW/RED: explain what to watch out for in simple terms",
      "action_id": "action_id_if_applicable (e.g. docker_cleanup, clear_temp)",
      "action": "Specific command or step (if no action_id)"
    }
  ],
  "upgrade_suggestion": {
    "needed": true/false,
    "reason": "Why upgrade might help",
    "current_specs": "What you have now",
    "recommended": "What to consider upgrading to"
  }
}

Always explain things in simple, non-technical language. Avoid jargon. Prefer using action_id when possible so users can click to execute."""
        
        user_prompt = f"""
Server Data:
{json.dumps(server_data, indent=2)}

Question: {question}

Provide recommendations in the JSON format specified. Be helpful and clear for non-technical users."""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=2000,
                response_format={"type": "json_object"}
            )
            
            content = response.choices[0].message.content
            result = json.loads(content)
            
            # Ensure all recommendations have required fields
            if "recommendations" in result:
                for rec in result["recommendations"]:
                    if "risk" not in rec:
                        rec["risk"] = "YELLOW"
                    if "considerations" not in rec:
                        rec["considerations"] = ""
                    if "action" not in rec:
                        rec["action"] = ""
            
            return result
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return {
                "summary": response.choices[0].message.content,
                "recommendations": [],
                "upgrade_suggestion": {"needed": False}
            }
        except Exception as e:
            # Check if it's an OpenAI API error
            error_str = str(e)
            
            # Extract error code from the error message or object
            error_code = None
            if hasattr(e, 'status_code'):
                error_code = e.status_code
            elif hasattr(e, 'code'):
                error_code = e.code
            elif '429' in error_str:
                error_code = 429
            elif '401' in error_str:
                error_code = 401
            
            # Handle 429 errors (rate limit or quota) - most common issue with credits available
            if error_code == 429 or "429" in error_str or "insufficient_quota" in error_str.lower() or "quota" in error_str.lower() or "rate_limit" in error_str.lower():
                return {
                    "summary": "⚠️ OpenAI API Rate Limit or Quota Issue",
                    "recommendations": [
                        {
                            "title": "Check Monthly Spending Limits (Most Likely Cause)",
                            "description": "Even with $57 in credits, you may have hit a monthly spending limit. This is separate from your credit balance and is the most common cause of this error.",
                            "risk": "YELLOW",
                            "considerations": "Go to OpenAI Platform → Settings → Limits to check or increase your monthly spending limit. Monthly limits can block requests even when you have credits.",
                            "action_id": "",
                            "action": "Visit https://platform.openai.com/settings/organization/limits"
                        },
                        {
                            "title": "Wait and Retry (Rate Limiting)",
                            "description": "If this is a rate limit (too many requests per minute), wait a few minutes and try again.",
                            "risk": "GREEN",
                            "considerations": "Rate limits reset after a short period. Try again in 1-2 minutes.",
                            "action_id": "",
                            "action": "Wait 1-2 minutes and refresh the page"
                        },
                        {
                            "title": "Verify API Key Organization",
                            "description": "Make sure the API key belongs to the same organization/account where you see the $57 credits.",
                            "risk": "YELLOW",
                            "considerations": "API keys are organization-specific. If the key is from a different org, it won't use those credits.",
                            "action_id": "",
                            "action": "Check API key at https://platform.openai.com/api-keys"
                        }
                    ],
                    "upgrade_suggestion": {"needed": False}
                }
            elif error_code == 401 or "401" in error_str or "invalid_api_key" in error_str.lower():
                return {
                    "summary": "⚠️ Invalid OpenAI API Key",
                    "recommendations": [
                        {
                            "title": "Check API Key Configuration",
                            "description": "The OpenAI API key is missing or invalid. Please verify it's correctly set in your server configuration.",
                            "risk": "YELLOW",
                            "considerations": "Make sure OPENAI_API_KEY environment variable is set correctly on the server.",
                            "action_id": "",
                            "action": "Verify OPENAI_API_KEY is set in systemd service file"
                        }
                    ],
                    "upgrade_suggestion": {"needed": False}
                }
            else:
                return {
                    "summary": f"⚠️ OpenAI API Error (Code: {error_code or 'Unknown'})",
                    "recommendations": [
                        {
                            "title": "Check Error Details",
                            "description": f"OpenAI API returned an error: {error_str[:200]}",
                            "risk": "YELLOW",
                            "considerations": "This may be a temporary issue. Try again in a few minutes.",
                            "action_id": "",
                            "action": "Retry the request or check server logs"
                        }
                    ],
                    "upgrade_suggestion": {"needed": False}
                }
    
    def get_quick_insights(self, server_data: Dict) -> List[str]:
        insights = []
        metrics = server_data.get("metrics", {})
        
        cpu = metrics.get("cpu", {}).get("percent", 0)
        mem = metrics.get("memory", {}).get("percent", 0)
        disk = metrics.get("disk", {}).get("percent", 0)
        
        if cpu > 80:
            insights.append(f"⚠️ High CPU usage: {cpu}%")
        if mem > 80:
            insights.append(f"⚠️ High memory usage: {mem}%")
        if disk > 80:
            insights.append(f"⚠️ High disk usage: {disk}%")
        
        if not insights:
            insights.append("✅ All metrics within normal range")
        
        return insights


