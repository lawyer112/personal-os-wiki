FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY api /app/api
COPY docs /app/docs

ENV WIKI_DATA_DIR=/data
ENV WIKI_HOST=0.0.0.0
ENV WIKI_PORT=3422

EXPOSE 3422
CMD ["python", "/app/api/site_server.py"]
