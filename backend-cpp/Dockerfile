
# ==========================================
# Stage 1: Build
# ==========================================
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

# Build and install Drogon
RUN git clone --depth 1 --branch v1.9.8 \
    https://github.com/drogonframework/drogon.git /tmp/drogon \
    && cd /tmp/drogon \
    && git submodule update --init \
    && cmake -B build \
        -DCMAKE_BUILD_TYPE=Release \
        -DBUILD_POSTGRESQL=ON \
        -DBUILD_EXAMPLES=OFF \
        -DBUILD_CTL=OFF \
    && cmake --build build --parallel 1 \
    && cmake --install build \
    && rm -rf /tmp/drogon

# Copy backend source from the repository root.
# Render Docker build context must be the repository root.
WORKDIR /src
COPY backend-cpp/ .

# Configure and build the backend
RUN cmake -B build -DCMAKE_BUILD_TYPE=Release

RUN cmake --build build --config Release --parallel 1

# Run tests if the test executable exists
RUN if [ -f ./build/mess_manager_tests ]; then \
        ./build/mess_manager_tests; \
    fi


# ==========================================
# Stage 2: Runtime
# ==========================================
FROM ubuntu:22.04 AS runner

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libjsoncpp25 \
    libssl3 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 appgroup \
    && useradd -u 1001 -g appgroup -m -s /bin/bash appuser

WORKDIR /app

# Copy backend executable
COPY --from=builder --chown=appuser:appgroup \
    /src/build/mess_manager_server \
    /app/mess_manager_server

# Copy migrations and configuration
COPY --from=builder --chown=appuser:appgroup \
    /src/migrations \
    /app/migrations

COPY --from=builder --chown=appuser:appgroup \
    /src/config \
    /app/config

# Create application data directory
RUN mkdir -p /app/data \
    && chown -R appuser:appgroup /app

USER appuser

ENV HOST=0.0.0.0
ENV PORT=8080
ENV APP_ENV=production
ENV LOG_LEVEL=INFO
ENV DATA_PATH=/app/data/mess_store.json

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

ENTRYPOINT ["/app/mess_manager_server"]
