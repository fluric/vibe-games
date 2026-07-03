FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (for docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Uvicorn will listen on the port specified by the PORT environment variable
# (Render/Railway inject this automatically)
ENV PORT=8765

CMD ["sh", "-c", "uvicorn service.main:app --host 0.0.0.0 --port $PORT"]
