#pragma once

#include <drogon/HttpController.h>

namespace mess_manager {
namespace controllers {

class NotificationController : public drogon::HttpController<NotificationController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(NotificationController::getNotifications, "/api/notifications", drogon::Get, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter");
    ADD_METHOD_TO(NotificationController::sendNotification, "/api/notifications", drogon::Post, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter");
    ADD_METHOD_TO(NotificationController::deleteNotification, "/api/notifications/{id}", drogon::Delete, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter");
    ADD_METHOD_TO(NotificationController::optionsHandler, "/api/notifications", drogon::Options, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(NotificationController::optionsHandler, "/api/notifications/*", drogon::Options, "mess_manager::middleware::CorsFilter");
    METHOD_LIST_END

    void getNotifications(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void sendNotification(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void deleteNotification(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback,
        const std::string &id
    );

    void optionsHandler(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );
};

} // namespace controllers
} // namespace mess_manager
