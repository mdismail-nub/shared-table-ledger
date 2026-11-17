#pragma once

#include <drogon/HttpController.h>

namespace mess_manager {
namespace controllers {

class WorkspaceController : public drogon::HttpController<WorkspaceController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(WorkspaceController::getWorkspace, "/api/workspace", drogon::Get, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter");
    ADD_METHOD_TO(WorkspaceController::getWorkspaceByCode, "/api/workspace/by-code", drogon::Post, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(WorkspaceController::previewMessByCode, "/api/workspace/preview/{code}", drogon::Get, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(WorkspaceController::previewMessByCode, "/api/invites/{code}", drogon::Get, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(WorkspaceController::previewMessByCode, "/api/invite/{code}", drogon::Get, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(WorkspaceController::optionsHandler, "/api/workspace", drogon::Options, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(WorkspaceController::optionsHandler, "/api/workspace/*", drogon::Options, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(WorkspaceController::optionsHandler, "/api/invites/*", drogon::Options, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(WorkspaceController::optionsHandler, "/api/invite/*", drogon::Options, "mess_manager::middleware::CorsFilter");
    METHOD_LIST_END

    void getWorkspace(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void getWorkspaceByCode(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void previewMessByCode(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback,
        const std::string &code
    );

    void optionsHandler(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );
};

} // namespace controllers
} // namespace mess_manager
