#pragma once

#include <functional>
#include <memory>
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

template<typename T>
class HttpFilter : public HttpFilterBase {
public:
    virtual ~HttpFilter() = default;
};

} // namespace drogon
