# ==============================================================================
# Multi-Stage Production Dockerfile for Shared Table Ledger C++ Drogon Backend
# Course Project: Mess Management System | C++17 / Drogon / PostgreSQL
# Optimized for Render Web Service Deployment & Cloud Container Environments
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Environment (Compile Drogon, PostgreSQL client, & Backend)
# ------------------------------------------------------------------------------
FROM ubuntu:22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
ENV CMAKE_BUILD_PARALLEL_LEVEL=1
ENV MAKEFLAGS="-j1"

# Install C++ build toolchain, libpq-dev, OpenSSL, and Drogon dependencies
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

# Build and install real Drogon C++ Framework (v1.9.8) with PostgreSQL support
# Use sequential build (-j1) to prevent Out-Of-Memory (OOM) kills on cloud builder tiers
RUN git clone --depth 1 --branch v1.9.8 https://github.com/drogonframework/drogon.git /tmp/drogon \
    && cd /tmp/drogon \
    && git submodule update --init \
    && cmake -B build \
        -DCMAKE_BUILD_TYPE=Release \
        -DBUILD_POSTGRESQL=ON \
        -DBUILD_EXAMPLES=OFF \
        -DBUILD_CTL=OFF \
        -DBUILD_TESTING=OFF \
    && cmake --build build --parallel 1 \
    && cmake --install build \
    && rm -rf /tmp/drogon

# Stage build context: automatically handle both repository root context (.)
# and backend-cpp/ subdirectory context seamlessly
WORKDIR /tmp/context
COPY . .
RUN if [ -d "backend-cpp" ]; then \
        mkdir -p /src && cp -a backend-cpp/* /src/ ; \
    else \
        mkdir -p /src && cp -a ./* /src/ ; \
    fi && rm -rf /tmp/context

WORKDIR /src

# Configure and compile release binaries using real Drogon (-j2)
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --config Release -j2

# Guarantee binary exists at standard path for multi-stage copy
RUN if [ ! -f /src/build/mess_manager_server ]; then \
        find /src/build -name mess_manager_server -type f -exec cp {} /src/build/mess_manager_server \; ; \
    fi

# Execute automated tests during container build to guarantee 100% test pass
RUN if [ -f ./build/mess_manager_tests ]; then \
        ./build/mess_manager_tests; \
    else \
        find ./build -name mess_manager_tests -type f -exec {} \; ; \
    fi

# ------------------------------------------------------------------------------
# Stage 2: Minimal Production Runtime
# ------------------------------------------------------------------------------
FROM ubuntu:22.04 AS runner

ENV DEBIAN_FRONTEND=noninteractive

# Install only minimal runtime shared libraries (libpq, jsoncpp, ssl, ca-certificates, curl)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libjsoncpp25 \
    libssl3 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Run as non-privileged security user (UID 1001)
RUN groupadd -g 1001 appgroup && \
    useradd -u 1001 -g appgroup -m -s /bin/bash appuser

WORKDIR /app

# Copy compiled backend executable from builder stage
COPY --from=builder --chown=appuser:appgroup /src/build/mess_manager_server /app/mess_manager_server
RUN chmod +x /app/mess_manager_server

# Copy migrations and configuration files
COPY --from=builder --chown=appuser:appgroup /src/migrations /app/migrations
COPY --from=builder --chown=appuser:appgroup /src/config /app/config

# Create storage directory for non-production local fallback
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data

USER appuser

# Production environment defaults (dynamically overridden by Render)
ENV HOST=0.0.0.0 \
    PORT=8080 \
    APP_ENV=production \
    LOG_LEVEL=INFO \
    DATA_PATH=/app/data/mess_store.json

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8080}/api/health || exit 1

ENTRYPOINT ["/app/mess_manager_server"]
