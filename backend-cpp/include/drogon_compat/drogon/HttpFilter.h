#pragma once

#include <functional>
#include <memory>
#include <string>
#include "HttpRequest.h"
#include "HttpResponse.h"

namespace drogon {

using FilterCallback = std::function<void(const HttpResponsePtr &)>;
using FilterChainCallback = std::function<void()>;

class HttpFilterBase {
public:
    virtual ~HttpFilterBase() = default;
    virtual void doFilter(
        const HttpRequestPtr &req,
        FilterCallback &&fcb,
        FilterChainCallback &&fccb
    ) = 0;
};

class HttpAppFramework;
HttpAppFramework &app();

template<typename T, bool AutoCreation = true>
class HttpFilter : public HttpFilterBase {
public:
    static const bool isAutoCreation = AutoCreation;
    virtual ~HttpFilter() = default;

    struct AutoRegister {
        AutoRegister() {
            registerToFramework();
        }
        static void registerToFramework();
    };
    inline static AutoRegister autoRegister_;
};

} // namespace drogon

#include "HttpAppFramework.h"

namespace drogon {

template<typename T, bool AutoCreation>
inline void HttpFilter<T, AutoCreation>::AutoRegister::registerToFramework() {
    HttpAppFramework::registerFilterCreator(
        utils::demangle(typeid(T).name()),
        []() -> std::shared_ptr<HttpFilterBase> {
            return std::make_shared<T>();
        }
    );
}

} // namespace drogon
