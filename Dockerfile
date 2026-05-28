FROM python:3.11-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend
COPY backend/ ./

# Copy built frontend (run `npm run build` first)
# The Vite build outputs to backend/static via vite.config.js
# so it's already included in COPY backend/

EXPOSE 8000

CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120"]
