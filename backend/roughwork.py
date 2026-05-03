from google import genai
import os

api = os.environ.get("GEMINI_API_KEY")

client = genai.Client(api_key=api)

models = client.models.list()

for model in models:
    print(model.name)