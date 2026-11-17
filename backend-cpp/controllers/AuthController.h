#pragma once

#include <drogon/HttpController.h>

namespace mess_manager {
namespace controllers {

class AuthController : public drogon::HttpController<AuthController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(AuthController::registerAdmin, "/api/auth/register", drogon::Post, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(AuthController::registerAdmin, "/api/auth/register-admin", drogon::Post, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(AuthController::login, "/api/auth/login", drogon::Post, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(AuthController::me, "/api/auth/me", drogon::Get, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter");
    ADD_METHOD_TO(AuthController::createGuestSession, "/api/auth/guest-session", drogon::Post, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(AuthController::createGuestSession, "/api/guest/session", drogon::Post, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(AuthController::optionsHandler, "/api/auth/*", drogon::Options, "mess_manager::middleware::CorsFilter");
    METHOD_LIST_END

    void registerAdmin(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void login(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void me(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void createGuestSession(
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
