#pragma once

#include <drogon/HttpFilter.h>

namespace mess_manager {
namespace middleware {

class CorsFilter : public drogon::HttpFilter<CorsFilter> {
public:
    void doFilter(
        const drogon::HttpRequestPtr &req,
        drogon::FilterCallback &&fcb,
        drogon::FilterChainCallback &&fccb
    ) override;
};

} // namespace middleware
} // namespace mess_manager
