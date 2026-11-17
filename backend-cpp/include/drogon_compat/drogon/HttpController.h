#pragma once

#include <string>
#include <vector>
#include <memory>
#include <functional>
#include <type_traits>
#include "HttpTypes.h"
#include "HttpRequest.h"
#include "HttpResponse.h"
#include "HttpFilter.h"
#include "HttpAppFramework.h"

namespace drogon {

template<typename Controller, typename Func>
inline void registerRouteHelper(Func func, const std::string &path, drogon::HttpMethod method, const std::vector<std::string> &filters) {
    RouteEntry entry;
    entry.path = path;
    entry.method = method;
    entry.filters = filters;

    if constexpr (std::is_invocable_v<Func, Controller*, const drogon::HttpRequestPtr&, std::function<void(const drogon::HttpResponsePtr&)>&&>) {
        entry.handler = [func](const drogon::HttpRequestPtr &req, std::function<void(const drogon::HttpResponsePtr &)> &&cb, const std::vector<std::string> &/*params*/) {
            static Controller ctrl;
            (ctrl.*func)(req, std::move(cb));
        };
    } else if constexpr (std::is_invocable_v<Func, Controller*, const drogon::HttpRequestPtr&, std::function<void(const drogon::HttpResponsePtr&)>&&, const std::string&>) {
        entry.handler = [func](const drogon::HttpRequestPtr &req, std::function<void(const drogon::HttpResponsePtr &)> &&cb, const std::vector<std::string> &params) {
            static Controller ctrl;
            std::string p = params.empty() ? "" : params[0];
            (ctrl.*func)(req, std::move(cb), p);
        };
    }
    
    app().addRoute(entry);
}

template<typename Controller, typename Func, typename... Filters>
inline bool registerRoute(Func func, const std::string &path, drogon::HttpMethod method, Filters... filters) {
    std::vector<std::string> filterList = { std::string(filters)... };
    registerRouteHelper<Controller>(func, path, method, filterList);
    return true;
}

template<typename T>
class HttpController {
public:
    using ControllerType = T;
    virtual ~HttpController() = default;
};

#define METHOD_LIST_BEGIN \
    struct _DrogonAutoRegister { \
        _DrogonAutoRegister() {

#define ADD_METHOD_TO(method, path, httpMethod, ...) \
            drogon::registerRoute<ControllerType>(&method, path, httpMethod, ##__VA_ARGS__);

#define METHOD_LIST_END \
        } \
    }; \
    inline static _DrogonAutoRegister _drogon_reg_instance;

} // namespace drogon
