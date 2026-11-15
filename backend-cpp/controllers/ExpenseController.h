#pragma once

#include <drogon/HttpController.h>

namespace mess_manager {
namespace controllers {

class ExpenseController : public drogon::HttpController<ExpenseController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(ExpenseController::getExpenses, "/api/expenses", drogon::Get, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter");
    ADD_METHOD_TO(ExpenseController::addExpense, "/api/expenses", drogon::Post, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter", "mess_manager::middleware::AdminOnlyFilter");
    ADD_METHOD_TO(ExpenseController::deleteExpense, "/api/expenses/{id}", drogon::Delete, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter", "mess_manager::middleware::AdminOnlyFilter");
    ADD_METHOD_TO(ExpenseController::optionsHandler, "/api/expenses", drogon::Options, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(ExpenseController::optionsHandler, "/api/expenses/*", drogon::Options, "mess_manager::middleware::CorsFilter");
    METHOD_LIST_END

    void getExpenses(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void addExpense(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void deleteExpense(
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
