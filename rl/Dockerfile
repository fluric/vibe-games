FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (for docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application into an 'rl' module directory
# so that absolute imports (e.g. from rl.games...) resolve properly.
COPY . ./rl

# Uvicorn will listen on the port specified by the PORT environment variable
# (Render/Railway inject this automatically)
ENV PORT=8765

CMD ["sh", "-c", "uvicorn rl.service.main:app --host :: --port $PORT"]
