#pragma once

#include <drogon/HttpController.h>

namespace mess_manager {
namespace controllers {

class AccountingController : public drogon::HttpController<AccountingController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(AccountingController::getLedger, "/api/accounting/ledger", drogon::Get, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter");
    ADD_METHOD_TO(AccountingController::getSummary, "/api/accounting/summary", drogon::Get, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter");
    ADD_METHOD_TO(AccountingController::getStatement, "/api/accounting/statement/{memberId}", drogon::Get, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter");
    ADD_METHOD_TO(AccountingController::optionsHandler, "/api/accounting", drogon::Options, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(AccountingController::optionsHandler, "/api/accounting/*", drogon::Options, "mess_manager::middleware::CorsFilter");
    METHOD_LIST_END

    void getLedger(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void getSummary(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void getStatement(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback,
        const std::string &memberId
    );

    void optionsHandler(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );
};

} // namespace controllers
} // namespace mess_manager
