#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <memory>
#include <cstdlib>
#include <cstdint>
#include <algorithm>
#include <exception>

#include <json/json.h>
#include <drogon/drogon.h>

#include "repositories/DatabaseManager.h"
#include "services/AuthService.h"
#include "middleware/AuthFilter.h"
#include "middleware/CorsFilter.h"

namespace mess_manager {
    extern services::AuthService *g_authService;
}

namespace {

struct AppConfig {
    std::string host = "0.0.0.0";
    uint16_t port = 8080;
    size_t threads = 4;

    std::string jwtSecret;
    std::string postgresUrl;
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
};

std::string trim(const std::string &value) {
    const auto first = value.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return "";
    const auto last = value.find_last_not_of(" \t\r\n");
    return value.substr(first, last - first + 1);
}

void loadConfigFile(AppConfig &config, const std::string &path) {
    std::ifstream file(path);
    if (!file.is_open()) {
        std::cout << "[Config] Config file not found. Using defaults and environment variables.\n";
        return;
    }

    Json::CharReaderBuilder reader;
    Json::Value root;
    std::string errors;

    if (!Json::parseFromStream(reader, file, &root, &errors)) {
        std::cerr << "[Config] Failed to parse config file: " << errors << "\n";
        return;
    }

    if (root.isMember("server") && root["server"].isObject()) {
        const auto &server = root["server"];
        if (server["host"].isString()) config.host = server["host"].asString();
        if (server["port"].isUInt()) {
            const unsigned int port = server["port"].asUInt();
            if (port > 0 && port <= 65535) config.port = static_cast<uint16_t>(port);
        }
        if (server["threads"].isUInt()) {
            const unsigned int threads = server["threads"].asUInt();
            if (threads > 0) config.threads = threads;
        }
        if (server["jwt_secret"].isString()) config.jwtSecret = server["jwt_secret"].asString();
        if (server["log_level"].isString()) config.logLevel = server["log_level"].asString();
    }

    if (root.isMember("database") && root["database"].isObject()) {
        const auto &database = root["database"];
        if (database["postgres_url"].isString()) config.postgresUrl = database["postgres_url"].asString();
        if (database["fallback_data_file"].isString()) config.fallbackDataPath = database["fallback_data_file"].asString();
    }

    if (root.isMember("cors") && root["cors"].isObject() && root["cors"]["allow_origins"].isArray()) {
        config.allowedOrigins.clear();
        for (const auto &origin : root["cors"]["allow_origins"]) {
            if (origin.isString()) {
                const std::string value = trim(origin.asString());
                if (!value.empty()) config.allowedOrigins.push_back(value);
            }
        }
    }

    std::cout << "[Config] Loaded configuration from " << path << "\n";
}

void loadEnvironment(AppConfig &config) {
    if (const char *envVal = std::getenv("APP_ENV")) {
        config.appEnv = envVal;
    }

    if (const char *portVal = std::getenv("PORT")) {
        const int port = std::atoi(portVal);
        if (port > 0 && port <= 65535) config.port = static_cast<uint16_t>(port);
    } else if (const char *appPortVal = std::getenv("APP_PORT")) {
        const int port = std::atoi(appPortVal);
        if (port > 0 && port <= 65535) config.port = static_cast<uint16_t>(port);
    }

    if (const char *hostVal = std::getenv("HOST")) {
        config.host = hostVal;
    } else if (const char *appHostVal = std::getenv("APP_HOST")) {
        config.host = appHostVal;
    }

    if (const char *jwtVal = std::getenv("JWT_SECRET")) {
        config.jwtSecret = jwtVal;
    }

    if (const char *dbVal = std::getenv("DATABASE_URL")) {
        config.postgresUrl = dbVal;
    } else if (const char *pgVal = std::getenv("POSTGRES_URL")) {
        config.postgresUrl = pgVal;
    }

    if (const char *logVal = std::getenv("LOG_LEVEL")) {
        config.logLevel = logVal;
    }

    if (const char *dataVal = std::getenv("DATA_PATH")) {
        config.fallbackDataPath = dataVal;
    }

    if (const char *corsListVal = std::getenv("CORS_ALLOWED_ORIGINS")) {
        config.allowedOrigins.clear();
        std::istringstream stream(corsListVal);
        std::string origin;
        while (std::getline(stream, origin, ',')) {
            origin = trim(origin);
            if (!origin.empty()) config.allowedOrigins.push_back(origin);
        }
    } else if (const char *corsVal = std::getenv("CORS_ORIGIN")) {
        config.allowedOrigins = {corsVal};
    }
}

bool validateConfig(const AppConfig &config) {
    const bool production = config.appEnv == "production";

    if (config.port == 0 || config.threads == 0) {
        std::cerr << "[FATAL] Invalid server port or thread count.\n";
        return false;
    }

    if (production) {
        if (config.jwtSecret.length() < 32 || config.jwtSecret.find("change") != std::string::npos) {
            std::cerr << "[FATAL] Production requires a JWT_SECRET of at least 32 characters.\n";
            return false;
        }

        if (config.postgresUrl.empty()) {
            std::cerr << "[FATAL] DATABASE_URL must be configured in production.\n";
            return false;
        }
    }

    return true;
}

trantor::Logger::LogLevel getLogLevel(const std::string &level) {
    if (level == "DEBUG") return trantor::Logger::kDebug;
    if (level == "WARN") return trantor::Logger::kWarn;
    if (level == "ERROR") return trantor::Logger::kError;
    return trantor::Logger::kInfo;
}

} // namespace

int main(int argc, char *argv[]) {
    std::cout << "====================================================\n"
              << "   Shared Table Ledger - C++ Drogon REST Backend\n"
              << "   Modern C++17 / PostgreSQL / Drogon Framework\n"
              << "====================================================\n";

    AppConfig config;
    const std::string configPath = (argc > 1) ? argv[1] : "./config/config.json";

    loadConfigFile(config, configPath);
    loadEnvironment(config);

    const bool isProduction = config.appEnv == "production";

    std::cout << "[Config] Environment: " << (isProduction ? "PRODUCTION" : "DEVELOPMENT") << "\n";
    std::cout << "[Config] Host: " << config.host << ", Port: " << config.port << ", Threads: " << config.threads << "\n";
    std::cout << "[Config] Log Level: " << config.logLevel << "\n";
    std::cout << "[Config] PostgreSQL: " << (config.postgresUrl.empty() ? "Not configured" : "Configured") << "\n";

    if (!validateConfig(config)) {
        return 1;
    }

    if (config.jwtSecret.empty()) {
        config.jwtSecret = "dev_secret_university_course_mess_manager_2026_default_key";
        std::cout << "[Config] Using development JWT secret.\n";
    }

    // Configure CORS allowed origins
    mess_manager::middleware::CorsFilter::setAllowedOrigins(config.allowedOrigins);

    // Initialize database
    std::cout << "[Database] Initializing data layer...\n";
    auto &database = mess_manager::repositories::DatabaseManager::instance();
    database.init(config.postgresUrl, config.fallbackDataPath);

    if (isProduction && !database.isPostgresConnected()) {
        std::cerr << "[FATAL] PostgreSQL connection failed: " << database.getPostgresError() << "\n";
        return 1;
    }

    // Run database migrations
    const bool migrationSuccess = database.runMigrations();
    if (isProduction && !migrationSuccess) {
        std::cerr << "[FATAL] Database migrations failed in production.\n";
        return 1;
    }

    std::cout << "[Database] Ready. PostgreSQL: "
              << (database.isPostgresConnected() ? "CONNECTED" : "STANDALONE")
              << "\n";

    // Initialize authentication service
    mess_manager::g_authService = new mess_manager::services::AuthService(config.jwtSecret);
    std::cout << "[Auth] JWT authentication initialized.\n";

    try {
        auto &app = drogon::app();

        app.setLogLevel(getLogLevel(config.logLevel));
        app.setThreadNum(config.threads);
        app.addListener(config.host, config.port);

        // Global Pre-Routing Advice for CORS Preflight OPTIONS requests
        app.registerPreRoutingAdvice([](const drogon::HttpRequestPtr &req, drogon::AdviceCallback &&acb, drogon::AdviceChainCallback &&accb) {
            if (req->method() == drogon::HttpMethod::Options) {
                std::string origin = req->getHeader("Origin");
                if (origin.empty()) origin = req->getHeader("origin");
                std::string resolved = mess_manager::middleware::CorsFilter::resolveOrigin(origin);

                auto resp = drogon::HttpResponse::newHttpResponse();
                resp->setStatusCode(drogon::k204NoContent);
                resp->addHeader("Access-Control-Allow-Origin", resolved);
                resp->addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
                resp->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Guest-Token, X-Requested-With, Accept");
                if (resolved != "*") {
                    resp->addHeader("Access-Control-Allow-Credentials", "true");
                }
                resp->addHeader("Access-Control-Max-Age", "86400");
                acb(resp);
                return;
            }
            accb();
        });

        // Global Post-Handling Advice to guarantee CORS headers on ALL responses
        app.registerPostHandlingAdvice([](const drogon::HttpRequestPtr &req, const drogon::HttpResponsePtr &resp) {
            if (!resp || !req) return;
            std::string origin = req->getHeader("Origin");
            if (origin.empty()) origin = req->getHeader("origin");
            std::string resolved = mess_manager::middleware::CorsFilter::resolveOrigin(origin);

            resp->addHeader("Access-Control-Allow-Origin", resolved);
            resp->addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
            resp->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Guest-Token, X-Requested-With, Accept");
            if (resolved != "*") {
                resp->addHeader("Access-Control-Allow-Credentials", "true");
            }
        });

        std::cout << "[Server] Listening on http://" << config.host << ":" << config.port << "\n";
        std::cout << "[Server] Ready to accept API requests.\n";

        app.run();

    } catch (const std::exception &exception) {
        std::cerr << "[FATAL] Server startup failed: " << exception.what() << "\n";
        delete mess_manager::g_authService;
        mess_manager::g_authService = nullptr;
        return 1;
    }

    delete mess_manager::g_authService;
    mess_manager::g_authService = nullptr;
    return 0;
}
