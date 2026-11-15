#pragma once

#include <drogon/HttpController.h>

namespace mess_manager {
namespace controllers {

class PaymentController : public drogon::HttpController<PaymentController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(PaymentController::getPayments, "/api/payments", drogon::Get, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter");
    ADD_METHOD_TO(PaymentController::addPayment, "/api/payments", drogon::Post, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter", "mess_manager::middleware::AdminOnlyFilter");
    ADD_METHOD_TO(PaymentController::deletePayment, "/api/payments/{id}", drogon::Delete, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter", "mess_manager::middleware::AdminOnlyFilter");
    ADD_METHOD_TO(PaymentController::optionsHandler, "/api/payments", drogon::Options, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(PaymentController::optionsHandler, "/api/payments/*", drogon::Options, "mess_manager::middleware::CorsFilter");
    METHOD_LIST_END

    void getPayments(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void addPayment(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void deletePayment(
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
