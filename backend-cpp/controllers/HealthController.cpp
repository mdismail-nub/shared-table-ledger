#include "HealthController.h"
#include <drogon/drogon.h>
#include "../repositories/DatabaseManager.h"
#include <json/json.h>
#include <chrono>

namespace mess_manager {
namespace controllers {

static auto g_startTime = std::chrono::steady_clock::now();

void HealthController::healthCheck(
    const drogon::HttpRequestPtr &/*req*/,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    auto now = std::chrono::steady_clock::now();
    auto uptimeSeconds = std::chrono::duration_cast<std::chrono::seconds>(now - g_startTime).count();

    const auto &db = repositories::DatabaseManager::instance();

    Json::Value root;
    root["status"] = "healthy";
    root["service"] = "mess_manager_cpp_backend";
    root["framework"] = "Modern C++17 / Drogon REST Framework";
    root["version"] = "1.0.0";
    root["uptime_seconds"] = static_cast<Json::Int64>(uptimeSeconds);
    root["database"] = db.isPostgresConnected() ? "postgresql_connected" : "standalone_file_active";

    auto resp = drogon::HttpResponse::newHttpJsonResponse(root);
    resp->setStatusCode(drogon::k200OK);
    callback(resp);
}

} // namespace controllers
} // namespace mess_manager
