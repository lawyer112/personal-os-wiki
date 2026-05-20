ARG PYTHON_IMAGE=python:3.12-slim
FROM ${PYTHON_IMAGE}

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY api/requirements.txt /app/api/requirements.txt
RUN pip install --no-cache-dir -r /app/api/requirements.txt
COPY api /app/api
COPY docs /app/docs

ENV WIKI_DATA_DIR=/data
ENV WIKI_HOST=0.0.0.0
ENV WIKI_PORT=3422

EXPOSE 3422
CMD ["python", "/app/api/server.py"]
