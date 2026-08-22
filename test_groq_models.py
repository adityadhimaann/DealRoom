import sys
import os
sys.path.append("/Users/aditya/Downloads/DealRoom/backend")
from groq import Groq
from app.config import get_settings

settings = get_settings()
client = Groq(api_key=settings.groq_api_key)
print(client.models.list())
