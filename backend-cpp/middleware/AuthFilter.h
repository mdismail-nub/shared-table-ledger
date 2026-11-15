#pragma once

#include <drogon/HttpFilter.h>
#include "../utils/JwtHelper.h"

namespace mess_manager {
namespace middleware {

// Validates Bearer JWT or Guest token and injects claims into request context
class AuthFilter : public drogon::HttpFilter<AuthFilter> {
public:
    void doFilter(
        const drogon::HttpRequestPtr &req,
        drogon::FilterCallback &&fcb,
        drogon::FilterChainCallback &&fccb
    ) override;
};

// Enforces that caller must hold an "admin" role
class AdminOnlyFilter : public drogon::HttpFilter<AdminOnlyFilter> {
public:
    void doFilter(
        const drogon::HttpRequestPtr &req,
        drogon::FilterCallback &&fcb,
        drogon::FilterChainCallback &&fccb
    ) override;
};

} // namespace middleware
} // namespace mess_manager
