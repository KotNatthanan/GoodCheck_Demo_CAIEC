FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 5050

# Run application
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5050} --workers ${WEB_CONCURRENCY:-4} run:app"]
