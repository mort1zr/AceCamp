# Worker del modelo de AceCam para Azure Container Apps (PCIT-226, historia PCIT-222).
# Se construye en .github/workflows/deploy-azure.yml. Azure for Students no tiene GPU: CPU.
FROM python:3.11-slim-bookworm@sha256:a83ba18aef0f865b1a4a611c2cf460fe446f2795673bbb9fe43be570439e3b39
LABEL org.opencontainers.image.source="https://github.com/mort1zr/AceCamp" \
      org.opencontainers.image.description="Worker del modelo de AceCam (PCIT-226)"

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
# OpenCV necesita estas bibliotecas del sistema.
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# PyTorch para CPU: la misma versión que requirements.txt, sin las bibliotecas de CUDA.
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch==2.5.1 torchvision==0.20.1
COPY requirements.txt requirements-worker.txt ./
RUN pip install -r requirements-worker.txt

COPY . .
# Pesos del modelo verificados con sha256: la construcción falla si alguno no coincide.
RUN python scripts/download_models.py --no-video --strict

ARG ACECAM_VERSION=local
ENV ACECAM_VERSION=${ACECAM_VERSION}
RUN useradd --create-home --uid 10001 worker && chown -R worker /app
USER worker

# Toma un partido "en cola", lo analiza y termina. Con la cola vacía termina en segundos.
CMD ["python", "-m", "worker", "--once", "--device", "cpu"]
