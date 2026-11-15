#pragma once

#include <drogon/HttpController.h>

namespace mess_manager {
namespace controllers {

class MealController : public drogon::HttpController<MealController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(MealController::getMeals, "/api/meals", drogon::Get, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter");
    ADD_METHOD_TO(MealController::upsertMeals, "/api/meals/daily", drogon::Post, "mess_manager::middleware::CorsFilter", "mess_manager::middleware::AuthFilter", "mess_manager::middleware::AdminOnlyFilter");
    ADD_METHOD_TO(MealController::optionsHandler, "/api/meals", drogon::Options, "mess_manager::middleware::CorsFilter");
    ADD_METHOD_TO(MealController::optionsHandler, "/api/meals/*", drogon::Options, "mess_manager::middleware::CorsFilter");
    METHOD_LIST_END

    void getMeals(
        const drogon::HttpRequestPtr &req,
        std::function<void(const drogon::HttpResponsePtr &)> &&callback
    );

    void upsertMeals(
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
