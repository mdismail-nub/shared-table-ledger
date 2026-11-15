#include "CorsFilter.h"
#include <drogon/drogon.h>

namespace mess_manager {
namespace middleware {

void CorsFilter::doFilter(
    const drogon::HttpRequestPtr &req,
    drogon::FilterCallback &&fcb,
    drogon::FilterChainCallback &&fccb
) {
    if (req->method() == drogon::HttpMethod::Options) {
        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k204NoContent);
        resp->addHeader("Access-Control-Allow-Origin", "*");
        resp->addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
        resp->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Guest-Token, X-Requested-With");
        resp->addHeader("Access-Control-Max-Age", "86400");
        fcb(resp);
        return;
    }

    fccb();
}

} // namespace middleware
} // namespace mess_manager
