#include <iostream>
#include <fstream>
#include <drogon/drogon.h>
#include "repositories/DatabaseManager.h"
#include "services/AuthService.h"
#include "middleware/AuthFilter.h"
#include "middleware/CorsFilter.h"

namespace mess_manager {
extern services::AuthService *g_authService;
}

int main(int argc, char *argv[]) {
    std::cout << "====================================================\n";
    std::cout << "   Shared Table Ledger — C++ Drogon REST Backend    \n";
    std::cout << "   Course Project | Modern C++17 / Drogon Framework \n";
    std::cout << "====================================================\n";

    std::string configPath = "./config/config.json";
    if (argc > 1) {
        configPath = argv[1];
    }

    std::string host = "0.0.0.0";
    uint16_t port = 8080;
    size_t threads = 4;
    std::string jwtSecret = "mess_manager_default_jwt_secret_key_change_in_production";
    std::string postgresUrl = "";
    std::string fallbackDataPath = "./data/mess_store.json";

    std::ifstream configFile(configPath);
    if (configFile.is_open()) {
        Json::CharReaderBuilder reader;
        Json::Value root;
        std::string errs;
        if (Json::parseFromStream(reader, configFile, &root, &errs)) {
            if (root.isMember("server")) {
                const auto &srv = root["server"];
                if (srv.isMember("host")) host = srv["host"].asString();
                if (srv.isMember("port")) port = static_cast<uint16_t>(srv["port"].asUInt());
                if (srv.isMember("threads")) threads = srv["threads"].asUInt();
                if (srv.isMember("jwt_secret")) jwtSecret = srv["jwt_secret"].asString();
            }
            if (root.isMember("database")) {
                const auto &db = root["database"];
                if (db.isMember("postgres_url")) postgresUrl = db["postgres_url"].asString();
                if (db.isMember("fallback_data_file")) fallbackDataPath = db["fallback_data_file"].asString();
            }
        }
    }

    // Environment Variable Overrides (Prioritized in Production Cloud Containers)
    if (const char *envPort = std::getenv("PORT")) {
        port = static_cast<uint16_t>(std::atoi(envPort));
    } else if (const char *envAppPort = std::getenv("APP_PORT")) {
        port = static_cast<uint16_t>(std::atoi(envAppPort));
    }
    if (const char *envHost = std::getenv("HOST")) {
        host = envHost;
    } else if (const char *envBind = std::getenv("BIND_HOST")) {
        host = envBind;
    }
    if (const char *envDb = std::getenv("DATABASE_URL")) {
        postgresUrl = envDb;
    } else if (const char *envPg = std::getenv("POSTGRES_URL")) {
        postgresUrl = envPg;
    }
    if (const char *envJwt = std::getenv("JWT_SECRET")) {
        jwtSecret = envJwt;
    }
    if (const char *envData = std::getenv("DATA_PATH")) {
        fallbackDataPath = envData;
    } else if (const char *envFallback = std::getenv("FALLBACK_DATA_PATH")) {
        fallbackDataPath = envFallback;
    }
    if (const char *envThreads = std::getenv("SERVER_THREADS")) {
        threads = static_cast<size_t>(std::atoi(envThreads));
    }

    std::cout << "[Config] Server Host: " << host << ", Port: " << port << ", Threads: " << threads << "\n";
    std::cout << "[Config] Storage Path: " << fallbackDataPath << "\n";
    std::cout << "[Config] PostgreSQL: " << (postgresUrl.empty() ? "None (Standalone Mode)" : "Configured via environment") << "\n";
    std::cout << "[Config] JWT Auth: " << (jwtSecret.empty() ? "Unconfigured" : "Protected Key Configured") << "\n";

    // Initialize Database & Migration
    std::cout << "[Database] Initializing data layer...\n";
    auto &db = mess_manager::repositories::DatabaseManager::instance();
    db.init(postgresUrl, fallbackDataPath);
    db.runMigrations();
    std::cout << "[Database] Ready (PostgreSQL: " << (db.isPostgresConnected() ? "CONNECTED" : "STANDALONE MODE") << ")\n";

    // Initialize Auth Service
    mess_manager::g_authService = new mess_manager::services::AuthService(jwtSecret);
    std::cout << "[Auth] JWT Authentication engine initialized.\n";

    // Configure Drogon Application
    drogon::app()
        .addListener(host, port)
        .setThreadNum(threads)
        .setLogLevel(trantor::Logger::kInfo);

    // Register Middleware Filters
    drogon::app().registerFilter("mess_manager::middleware::CorsFilter", std::make_shared<mess_manager::middleware::CorsFilter>());
    drogon::app().registerFilter("mess_manager::middleware::AuthFilter", std::make_shared<mess_manager::middleware::AuthFilter>());
    drogon::app().registerFilter("mess_manager::middleware::AdminOnlyFilter", std::make_shared<mess_manager::middleware::AdminOnlyFilter>());

    std::cout << "[Server] Listening on http://" << host << ":" << port << "\n";
    std::cout << "[Server] Ready to accept API requests from React frontend.\n";

    drogon::app().run();

    delete mess_manager::g_authService;
    return 0;
}
