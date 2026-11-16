#pragma once

#include <drogon/HttpController.h>

namespace mess_manager {
namespace controllers {

class HealthController : public drogon::HttpController<HealthController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(HealthController::healthCheck, "/api/health", drogon::Get, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(HealthController::healthCheck, "/health", drogon::Get, "mess_manager::middleware::CorsFilter");
    METHOD_LIST_END

    void healthCheck(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );
};

} // namespace controllers
} // namespace mess_manager
