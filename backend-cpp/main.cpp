
#include <iostream>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <memory>
#include <cstdlib>
#include <cstdint>
#include <algorithm>

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

    if (first == std::string::npos) {
        return "";
    }

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

        if (server["host"].isString())
            config.host = server["host"].asString();

        if (server["port"].isUInt())
            config.port = static_cast<uint16_t>(server["port"].asUInt());

        if (server["threads"].isUInt())
            config.threads = server["threads"].asUInt();

        if (server["jwt_secret"].isString())
            config.jwtSecret = server["jwt_secret"].asString();

        if (server["log_level"].isString())
            config.logLevel = server["log_level"].asString();
    }

    if (root.isMember("database") && root["database"].isObject()) {
        const auto &database = root["database"];

        if (database["postgres_url"].isString())
            config.postgresUrl = database["postgres_url"].asString();

        if (database["fallback_data_file"].isString())
            config.fallbackDataPath = database["fallback_data_file"].asString();
    }

    if (root.isMember("cors") &&
        root["cors"].isObject() &&
        root["cors"]["allow_origins"].isArray()) {

        config.allowedOrigins.clear();

        for (const auto &origin : root["cors"]["allow_origins"]) {
            if (origin.isString()) {
                const auto value = trim(origin.asString());

                if (!value.empty()) {
                    config.allowedOrigins.push_back(value);
                }
            }
        }
    }
}

void loadEnvironment(AppConfig &config) {
    auto getEnv = [](const char *name) -> const char * {
        return std::getenv(name);
    };

    if (const char *value = getEnv("APP_ENV"))
        config.appEnv = value;

    if (const char *value = getEnv("PORT")) {
        const int port = std::atoi(value);

        if (port > 0 && port <= 65535)
            config.port = static_cast<uint16_t>(port);
    } else if (const char *value = getEnv("APP_PORT")) {
        const int port = std::atoi(value);

        if (port > 0 && port <= 65535)
            config.port = static_cast<uint16_t>(port);
    }

    if (const char *value = getEnv("HOST"))
        config.host = value;
    else if (const char *value = getEnv("BIND_HOST"))
        config.host = value;

    if (const char *value = getEnv("DATABASE_URL"))
        config.postgresUrl = value;
    else if (const char *value = getEnv("POSTGRES_URL"))
        config.postgresUrl = value;

    if (const char *value = getEnv("JWT_SECRET"))
        config.jwtSecret = value;

    if (const char *value = getEnv("DATA_PATH"))
        config.fallbackDataPath = value;
    else if (const char *value = getEnv("FALLBACK_DATA_PATH"))
        config.fallbackDataPath = value;

    if (const char *value = getEnv("SERVER_THREADS")) {
        const int threads = std::atoi(value);

        if (threads > 0)
            config.threads = static_cast<size_t>(threads);
    }

    if (const char *value = getEnv("LOG_LEVEL"))
        config.logLevel = value;

    if (const char *value = getEnv("CORS_ALLOWED_ORIGINS")) {
        config.allowedOrigins.clear();

        std::istringstream stream(value);
        std::string origin;

        while (std::getline(stream, origin, ',')) {
            origin = trim(origin);

            if (!origin.empty()) {
                config.allowedOrigins.push_back(origin);
            }
        }
    } else if (const char *value = getEnv("CORS_ORIGIN")) {
        config.allowedOrigins = {value};
    }
}

bool validateConfig(const AppConfig &config) {
    const bool production = config.appEnv == "production";

    if (config.port == 0 || config.threads == 0) {
        std::cerr << "[FATAL] Invalid server port or thread count.\n";
        return false;
    }

    if (production) {
        if (config.jwtSecret.length() < 32 ||
            config.jwtSecret.find("change") != std::string::npos) {
            std::cerr << "[FATAL] Production requires a JWT_SECRET of at least 32 characters.\n";
            return false;
        }

        if (config.postgresUrl.empty()) {
            std::cerr << "[FATAL] DATABASE_URL must be configured in production.\n";
            return false;
        }
    } else if (config.jwtSecret.empty()) {
        std::cerr << "[Config] Using development JWT secret.\n";
    }

    return true;
}

trantor::Logger::LogLevel getLogLevel(const std::string &level) {
    if (level == "DEBUG")
        return trantor::Logger::kDebug;

    if (level == "WARN")
        return trantor::Logger::kWarn;

    if (level == "ERROR")
        return trantor::Logger::kError;

    return trantor::Logger::kInfo;
}

} // namespace

int main(int argc, char *argv[]) {
    std::cout << "====================================================\n";
    std::cout << "   Shared Table Ledger — C++ Drogon REST Backend    \n";
    std::cout << "   Course Project | Modern C++17 / Drogon Framework \n";
    std::cout << "====================================================\n";

    AppConfig config;

    const std::string configPath =
        (argc > 1) ? argv[1] : "./config/config.json";

    loadConfigFile(config, configPath);
    loadEnvironment(config);

    const bool isProduction = config.appEnv == "production";

    std::cout << "[Config] Environment: "
              << (isProduction ? "PRODUCTION" : "DEVELOPMENT") << "\n";

    std::cout << "[Config] Host: " << config.host
              << ", Port: " << config.port
              << ", Threads: " << config.threads << "\n";

    std::cout << "[Config] Log Level: " << config.logLevel << "\n";

    std::cout << "[Config] PostgreSQL: "
              << (config.postgresUrl.empty() ? "Not configured" : "Configured")
              << "\n";

    if (!validateConfig(config)) {
        return 1;
    }

    if (config.jwtSecret.empty()) {
        config.jwtSecret =
            "dev_secret_university_course_mess_manager_2026_default_key";
    }

    // ==================================================
    // CORS CONFIGURATION
    // ==================================================

    mess_manager::middleware::CorsFilter::setAllowedOrigins(
        config.allowedOrigins
    );

    // ==================================================
    // DATABASE INITIALIZATION
    // ==================================================

    std::cout << "[Database] Initializing data layer...\n";

    auto &database =
        mess_manager::repositories::DatabaseManager::instance();

    database.init(
        config.postgresUrl,
        config.fallbackDataPath
    );

    if (isProduction && !database.isPostgresConnected()) {
        std::cerr << "[FATAL] PostgreSQL connection failed: "
                  << database.getPostgresError() << "\n";

        return 1;
    }

    const bool migrationSuccess = database.runMigrations();

    if (isProduction && !migrationSuccess) {
        std::cerr << "[FATAL] Database migrations failed.\n";
        return 1;
    }

    std::cout << "[Database] Ready. PostgreSQL: "
              << (database.isPostgresConnected() ? "CONNECTED" : "STANDALONE")
              << "\n";

    // ==================================================
    // AUTHENTICATION INITIALIZATION
    // ==================================================

    mess_manager::g_authService =
        new mess_manager::services::AuthService(config.jwtSecret);

    std::cout << "[Auth] JWT authentication initialized.\n";

    // ==================================================
    // DROGON CONFIGURATION
    // ==================================================

    try {
        auto &app = drogon::app();

        app.setLogLevel(getLogLevel(config.logLevel));
        app.setThreadNum(static_cast<size_t>(config.threads));
        app.addListener(config.host, config.port);

        // Register application filters
        app.registerFilter(
            "mess_manager::middleware::CorsFilter",
            std::make_shared<mess_manager::middleware::CorsFilter>()
        );

        app.registerFilter(
            "mess_manager::middleware::AuthFilter",
            std::make_shared<mess_manager::middleware::AuthFilter>()
        );

        app.registerFilter(
            "mess_manager::middleware::AdminOnlyFilter",
            std::make_shared<mess_manager::middleware::AdminOnlyFilter>()
        );

        std::cout << "[Server] Listening on http://"
                  << config.host << ":" << config.port << "\n";

        std::cout << "[Server] Ready to accept API requests.\n";

        app.run();

    } catch (const std::exception &exception) {
        std::cerr << "[FATAL] Server startup failed: "
                  << exception.what() << "\n";

        delete mess_manager::g_authService;
        mess_manager::g_authService = nullptr;

        return 1;
    }

    delete mess_manager::g_authService;
    mess_manager::g_authService = nullptr;

    return 0;
}
