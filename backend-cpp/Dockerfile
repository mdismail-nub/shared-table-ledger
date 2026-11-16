
# ==============================================================================
# Shared Table Ledger - Production Dockerfile
# C++17 / Drogon 1.9.8 / PostgreSQL
# Memory-optimized for Render
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Builder
# ------------------------------------------------------------------------------
FROM ubuntu:22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
ENV CMAKE_BUILD_PARALLEL_LEVEL=1
ENV MAKEFLAGS="-j1"

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    libssl-dev \
    libpq-dev \
    libjsoncpp-dev \
    uuid-dev \
    zlib1g-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Build Drogon with PostgreSQL support
RUN git clone --depth 1 --branch v1.9.8 \
    https://github.com/drogonframework/drogon.git /tmp/drogon \
    && cd /tmp/drogon \
    && git submodule update --init --recursive \
    && cmake -B build \
        -DCMAKE_BUILD_TYPE=Release \
        -DBUILD_POSTGRESQL=ON \
        -DBUILD_EXAMPLES=OFF \
        -DBUILD_CTL=OFF \
    && cmake --build build --parallel 1 \
    && cmake --install build \
    && rm -rf /tmp/drogon

WORKDIR /src

COPY . .

# Configure backend
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release

# Compile backend sequentially
RUN cmake --build build --config Release --parallel 1

# Run tests if available
RUN if [ -x ./build/mess_manager_tests ]; then \
        ./build/mess_manager_tests; \
    fi

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM ubuntu:22.04 AS runner

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libjsoncpp25 \
    libssl3 \
    ca-certificates \
    curl \
    zlib1g \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -m -s /bin/bash appuser

WORKDIR /app

# Copy executable
COPY --from=builder --chown=appuser:appgroup \
    /src/build/mess_manager_server /app/mess_manager_server

# Copy migrations and configuration
COPY --from=builder --chown=appuser:appgroup \
    /src/migrations /app/migrations

COPY --from=builder --chown=appuser:appgroup \
    /src/config /app/config

RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data

USER appuser

ENV HOST=0.0.0.0 \
    PORT=8080 \
    APP_ENV=production \
    LOG_LEVEL=INFO \
    DATA_PATH=/app/data/mess_store.json

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/api/health || exit 1

ENTRYPOINT ["/app/mess_manager_server"]
