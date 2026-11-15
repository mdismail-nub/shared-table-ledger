#pragma once

#include <drogon/HttpController.h>

namespace mess_manager {
namespace controllers {

class ReportController : public drogon::HttpController<ReportController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(ReportController::getCsvReport, "/api/reports/csv", drogon::Get, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter");
    ADD_METHOD_TO(ReportController::optionsHandler, "/api/reports/csv", drogon::Options, "mess_manager::middleware::CorsFilter");
    METHOD_LIST_END

    void getCsvReport(
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
