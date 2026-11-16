#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
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
    std::string jwtSecret = "";
    std::string postgresUrl = "";
    std::string fallbackDataPath = "./data/mess_store.json";
    std::string appEnv = "development";
    std::string logLevel = "INFO";
    std::vector<std::string> allowedOrigins = {
        "https://shared-table-ledger.vercel.app",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173"
    };

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
                if (srv.isMember("log_level")) logLevel = srv["log_level"].asString();
            }
            if (root.isMember("database")) {
                const auto &db = root["database"];
                if (db.isMember("postgres_url")) postgresUrl = db["postgres_url"].asString();
                if (db.isMember("fallback_data_file")) fallbackDataPath = db["fallback_data_file"].asString();
            }
            if (root.isMember("cors") && root["cors"].isMember("allow_origins") && root["cors"]["allow_origins"].isArray()) {
                allowedOrigins.clear();
                for (const auto &item : root["cors"]["allow_origins"]) {
                    allowedOrigins.push_back(item.asString());
                }
            }
        }
    }

    // Environment Variable Overrides (Prioritized in Production Cloud Containers)
    if (const char *envEnv = std::getenv("APP_ENV")) {
        appEnv = envEnv;
    }
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
    if (const char *envLogLevel = std::getenv("LOG_LEVEL")) {
        logLevel = envLogLevel;
    }
    if (const char *envCors = std::getenv("CORS_ALLOWED_ORIGINS")) {
        std::string originsStr = envCors;
        std::istringstream iss(originsStr);
        std::string token;
        allowedOrigins.clear();
        while (std::getline(iss, token, ',')) {
            size_t first = token.find_first_not_of(" \t\r\n");
            if (first != std::string::npos) {
                size_t last = token.find_last_not_of(" \t\r\n");
                allowedOrigins.push_back(token.substr(first, (last - first + 1)));
            }
        }
    } else if (const char *envCorsSingle = std::getenv("CORS_ORIGIN")) {
        allowedOrigins = { envCorsSingle };
    }

    mess_manager::middleware::CorsFilter::setAllowedOrigins(allowedOrigins);

    bool isProduction = (appEnv == "production");

    std::cout << "[Config] Environment: " << (isProduction ? "PRODUCTION" : "DEVELOPMENT") << "\n";
    std::cout << "[Config] Server Host: " << host << ", Port: " << port << ", Threads: " << threads << "\n";
    std::cout << "[Config] Log Level: " << logLevel << "\n";
    std::cout << "[Config] PostgreSQL: " << (postgresUrl.empty() ? "Unset" : "Configured via environment") << "\n";

    // Production Hardening Validations
    if (isProduction) {
        if (jwtSecret.empty() || jwtSecret.length() < 32 || jwtSecret.find("change") != std::string::npos) {
            std::cerr << "[FATAL] In production mode (APP_ENV=production), JWT_SECRET must be set via environment variable and be at least 32 characters long!\n";
            return 1;
        }
        if (postgresUrl.empty()) {
            std::cerr << "[FATAL] In production mode (APP_ENV=production), DATABASE_URL must be configured! JSON file storage is prohibited in production.\n";
            return 1;
        }
    } else {
        if (jwtSecret.empty()) {
            jwtSecret = "dev_secret_university_course_mess_manager_2026_default_key";
            std::cout << "[Config] JWT Secret: Using development default key (set JWT_SECRET for production).\n";
        }
    }

    // Initialize Database & Migration
    std::cout << "[Database] Initializing data layer...\n";
    auto &db = mess_manager::repositories::DatabaseManager::instance();
    db.init(postgresUrl, fallbackDataPath);

    if (isProduction && !db.isPostgresConnected()) {
        std::cerr << "[FATAL] PostgreSQL connection failed in production! DatabaseManager error: "
                  << db.getPostgresError() << "\n";
        std::cerr << "[FATAL] Application refusing to start to prevent unpersisted data loss.\n";
        return 1;
    }

    bool migrationSuccess = db.runMigrations();
    if (isProduction && !migrationSuccess) {
        std::cerr << "[FATAL] Database migrations failed in production mode!\n";
        return 1;
    }

    std::cout << "[Database] Ready (PostgreSQL: "
              << (db.isPostgresConnected() ? "CONNECTED" : "DEVELOPMENT STANDALONE MODE") << ")\n";

    // Initialize Auth Service
    mess_manager::g_authService = new mess_manager::services::AuthService(jwtSecret);
    std::cout << "[Auth] JWT Authentication engine initialized.\n";

    // Configure Drogon Application
    auto trantorLogLevel = trantor::Logger::kInfo;
    if (logLevel == "DEBUG") trantorLogLevel = trantor::Logger::kDebug;
    else if (logLevel == "WARN") trantorLogLevel = trantor::Logger::kWarn;
    else if (logLevel == "ERROR") trantorLogLevel = trantor::Logger::kError;

    drogon::app()
        .addListener(host, port)
        .setThreadNum(threads)
        .setLogLevel(trantorLogLevel);

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
