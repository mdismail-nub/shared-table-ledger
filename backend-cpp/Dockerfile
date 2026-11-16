# Multi-stage production build for Shared Table Ledger C++ Backend
# Course Project: C++17 / Drogon REST API

# --- Stage 1: Build & Compile ---
FROM ubuntu:22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    libssl-dev \
    libpq-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src

# Copy backend C++ source files
COPY . .

# Configure and compile release binary
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --config Release -j$(nproc)

# --- Stage 2: Minimal Production Runtime ---
FROM ubuntu:22.04 AS runner

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Run as non-privileged user for security
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -m appuser

WORKDIR /app

# Copy compiled executable from builder stage
COPY --from=builder --chown=appuser:appgroup /src/build/mess_manager_server /app/mess_manager_server
# If binary was built in bin/Release:
RUN if [ ! -f /app/mess_manager_server ]; then \
        find /src/build -name mess_manager_server -exec cp {} /app/mess_manager_server \; ; \
    fi && chmod +x /app/mess_manager_server

# Prepare persistent data directory
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data

USER appuser

# Default configuration (overridden dynamically by cloud container platforms)
ENV HOST=0.0.0.0 \
    PORT=8080 \
    DATA_PATH=/app/data/mess_store.json \
    JWT_SECRET=production_secret_key_change_via_env \
    CORS_ORIGIN=*

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/api/health || exit 1

ENTRYPOINT ["/app/mess_manager_server"]
