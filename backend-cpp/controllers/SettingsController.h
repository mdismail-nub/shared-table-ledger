#pragma once

#include <drogon/HttpController.h>

namespace mess_manager {
namespace controllers {

class SettingsController : public drogon::HttpController<SettingsController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(SettingsController::getInviteCode, "/api/settings/invite-code", drogon::Get, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter");
    ADD_METHOD_TO(SettingsController::getInviteCode, "/api/mess/invite-code", drogon::Get, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter");
    ADD_METHOD_TO(SettingsController::updateSettings, "/api/settings", drogon::Put, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter", "mess_manager::middleware::AdminOnlyFilter");
    ADD_METHOD_TO(SettingsController::regenerateCode, "/api/settings/regenerate-code", drogon::Post, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter", "mess_manager::middleware::AdminOnlyFilter");
    ADD_METHOD_TO(SettingsController::optionsHandler, "/api/settings", drogon::Options, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(SettingsController::optionsHandler, "/api/settings/*", drogon::Options, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(SettingsController::optionsHandler, "/api/mess/*", drogon::Options, "mess_manager::middleware::CorsFilter");
    METHOD_LIST_END

    void getInviteCode(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void updateSettings(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void regenerateCode(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void optionsHandler(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );
};

} // namespace controllers
} // namespace mess_manager
