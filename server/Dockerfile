# Matches the Python version this app is developed/tested against locally
# (3.10) — several deps here (numpy, psycopg-binary, spaCy's blis/thinc,
# cryptography) ship as compiled wheels, so staying on the exact tested
# version avoids surprises from a wheel not existing for a newer one.
FROM python:3.10-slim-bookworm AS builder

WORKDIR /app

# build-essential covers the rare case a dependency has no prebuilt wheel
# for this exact image; not needed in the final image, hence the separate
# builder stage.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


FROM python:3.10-slim-bookworm

RUN groupadd --system app && useradd --system --gid app --home-dir /app app

WORKDIR /app

COPY --from=builder /install /usr/local
COPY . .

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Runs against settings.py's built-in fallback defaults (no real secrets or
# GCP access needed) — this only needs to produce the WhiteNoise manifest
# that gets baked into the image, not a live DB/GCS connection.
RUN python manage.py collectstatic --noinput

RUN chown -R app:app /app
USER app

EXPOSE 8080

# $PORT is set by Cloud Run; 8080 is the local/default fallback. `exec`
# replaces the shell with gunicorn as PID 1, so it actually receives SIGTERM
# on scale-down instead of the shell swallowing it.
CMD ["sh", "-c", "exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8080} --workers 2 --threads 4 --timeout 60"]
