from openai import OpenAI
from config import OPENAI_API_KEY
from typing import Dict, List

class ServerAssistant:
    def __init__(self):
        self.client = OpenAI(api_key=OPENAI_API_KEY)
    
    def analyze(self, question: str, server_data: Dict) -> str:
        system_prompt = """You are a server administrator assistant. Analyze the provided server metrics and answer questions about server health, performance, and recommendations. Be concise but thorough."""
        
        user_prompt = f"""
Server Data:
{server_data}

Question: {question}
"""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=1000
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"Error: {str(e)}"
    
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

