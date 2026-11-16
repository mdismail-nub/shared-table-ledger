#pragma once

#include <drogon/HttpFilter.h>
#include <string>
#include <vector>

namespace mess_manager {
namespace middleware {

class CorsFilter : public drogon::HttpFilter<CorsFilter> {
public:
    static void setAllowedOrigins(const std::vector<std::string> &origins);
    static bool isOriginAllowed(const std::string &origin);
    static std::string resolveOrigin(const std::string &origin);

    void doFilter(
        const drogon::HttpRequestPtr &req,
        drogon::FilterCallback &&fcb,
        drogon::FilterChainCallback &&fccb
    ) override;
};

} // namespace middleware
} // namespace mess_manager
