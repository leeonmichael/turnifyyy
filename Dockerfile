FROM python:3.12-slim

# Node.js (para compilar el frontend Angular) + herramientas de build nativas
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY frontend/package.json frontend/package-lock.json frontend/
RUN npm --prefix frontend ci

COPY . .
RUN npm --prefix frontend run build
RUN python manage.py collectstatic --noinput

ENV PORT=8000
EXPOSE 8000

CMD python manage.py migrate --noinput && python -m daphne -b 0.0.0.0 -p $PORT config.asgi:application
