#pragma once

#include <drogon/HttpController.h>

namespace mess_manager {
namespace controllers {

class MemberController : public drogon::HttpController<MemberController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(MemberController::getMembers, "/api/members", drogon::Get, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter");
    ADD_METHOD_TO(MemberController::addMember, "/api/members", drogon::Post, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter", "mess_manager::middleware::AdminOnlyFilter");
    ADD_METHOD_TO(MemberController::updateStatus, "/api/members/{id}/status", drogon::Put, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter", "mess_manager::middleware::AdminOnlyFilter");
    ADD_METHOD_TO(MemberController::deleteMember, "/api/members/{id}", drogon::Delete, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter", "mess_manager::middleware::AdminOnlyFilter");
    ADD_METHOD_TO(MemberController::optionsHandler, "/api/members", drogon::Options, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(MemberController::optionsHandler, "/api/members/*", drogon::Options, "mess_manager::middleware::CorsFilter");
    METHOD_LIST_END

    void getMembers(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void addMember(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void updateStatus(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback,
        const std::string &id
    );

    void deleteMember(
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
