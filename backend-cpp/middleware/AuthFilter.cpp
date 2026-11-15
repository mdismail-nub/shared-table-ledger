#include "AuthFilter.h"
#include "../services/AuthService.h"
#include <drogon/drogon.h>

namespace mess_manager {
extern services::AuthService *g_authService;

namespace middleware {

void AuthFilter::doFilter(
    const drogon::HttpRequestPtr &req,
    drogon::FilterCallback &&fcb,
    drogon::FilterChainCallback &&fccb
) {
    if (req->method() == drogon::HttpMethod::Options) {
        fccb();
        return;
    }

    std::string token;
    std::string authHeader = req->getHeader("Authorization");
    if (!authHeader.empty() && authHeader.rfind("Bearer ", 0) == 0) {
        token = authHeader.substr(7);
    } else {
        token = req->getHeader("X-Guest-Token");
    }

    if (token.empty()) {
        token = req->getParameter("token");
    }

    if (token.empty() || !g_authService) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(
            Json::Value([]() {
                Json::Value v;
                v["error"] = "Unauthorized: Missing authentication token";
                return v;
            }())
        );
        resp->setStatusCode(drogon::k401Unauthorized);
        fcb(resp);
        return;
    }

    auto claimsOpt = g_authService->verifyAuth(token);
    if (!claimsOpt.has_value()) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(
            Json::Value([]() {
                Json::Value v;
                v["error"] = "Unauthorized: Invalid or expired authentication token";
                return v;
            }())
        );
        resp->setStatusCode(drogon::k401Unauthorized);
        fcb(resp);
        return;
    }

    // Attach claims to request attributes
    req->getAttributes()->insert("claims", *claimsOpt);
    req->getAttributes()->insert("role", claimsOpt->role);
    req->getAttributes()->insert("messId", claimsOpt->messId);
    req->getAttributes()->insert("userId", claimsOpt->userId);
    if (claimsOpt->memberId.has_value()) {
        req->getAttributes()->insert("memberId", *claimsOpt->memberId);
    }

    fccb();
}

void AdminOnlyFilter::doFilter(
    const drogon::HttpRequestPtr &req,
    drogon::FilterCallback &&fcb,
    drogon::FilterChainCallback &&fccb
) {
    if (req->method() == drogon::HttpMethod::Options) {
        fccb();
        return;
    }

    if (!req->getAttributes()->find("role")) {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(
            Json::Value([]() {
                Json::Value v;
                v["error"] = "Unauthorized: Authentication required";
                return v;
            }())
        );
        resp->setStatusCode(drogon::k401Unauthorized);
        fcb(resp);
        return;
    }

    std::string role = req->getAttributes()->get<std::string>("role");
    if (role != "admin") {
        auto resp = drogon::HttpResponse::newHttpJsonResponse(
            Json::Value([]() {
                Json::Value v;
                v["error"] = "Forbidden: Administrator privileges required for this action";
                return v;
            }())
        );
        resp->setStatusCode(drogon::k403Forbidden);
        fcb(resp);
        return;
    }

    fccb();
}

} // namespace middleware
} // namespace mess_manager
