#include "CorsFilter.h"
#include <drogon/drogon.h>
#include <algorithm>
#include <sstream>
#include <mutex>

namespace mess_manager {
namespace middleware {

namespace {
std::mutex g_corsMutex;
std::vector<std::string> g_allowedOrigins = {
    "https://shared-table-ledger.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173"
};

std::string trim(const std::string &str) {
    size_t first = str.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return "";
    size_t last = str.find_last_not_of(" \t\r\n");
    return str.substr(first, (last - first + 1));
}
}

void CorsFilter::setAllowedOrigins(const std::vector<std::string> &origins) {
    std::lock_guard<std::mutex> lock(g_corsMutex);
    g_allowedOrigins.clear();
    for (const auto &o : origins) {
        std::string trimmed = trim(o);
        if (!trimmed.empty()) {
            g_allowedOrigins.push_back(trimmed);
        }
    }
}

bool CorsFilter::isOriginAllowed(const std::string &origin) {
    if (origin.empty()) return false;
    std::string clean = trim(origin);

    const char *appEnv = std::getenv("APP_ENV");
    bool isDev = (!appEnv || std::string(appEnv) != "production");

    // In development mode, allow localhost and 127.0.0.1 ports
    if (isDev) {
        if (clean.rfind("http://localhost:", 0) == 0 ||
            clean.rfind("http://127.0.0.1:", 0) == 0 ||
            clean == "http://localhost" ||
            clean == "http://127.0.0.1") {
            return true;
        }
    }

    std::lock_guard<std::mutex> lock(g_corsMutex);
    for (const auto &allowed : g_allowedOrigins) {
        if (allowed == "*" || allowed == clean) {
            return true;
        }
    }
    return false;
}

std::string CorsFilter::resolveOrigin(const std::string &origin) {
    if (isOriginAllowed(origin)) {
        return trim(origin);
    }
    std::lock_guard<std::mutex> lock(g_corsMutex);
    if (!g_allowedOrigins.empty() && g_allowedOrigins[0] != "*") {
        return g_allowedOrigins[0];
    }
    return "*";
}

void CorsFilter::doFilter(
    const drogon::HttpRequestPtr &req,
    drogon::FilterCallback &&fcb,
    drogon::FilterChainCallback &&fccb
) {
    if (req->method() == drogon::HttpMethod::Options) {
        std::string origin = req->getHeader("Origin");
        if (origin.empty()) origin = req->getHeader("origin");
        std::string resolved = resolveOrigin(origin);

        auto resp = drogon::HttpResponse::newHttpResponse();
        resp->setStatusCode(drogon::k204NoContent);
        resp->addHeader("Access-Control-Allow-Origin", resolved);
        resp->addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
        resp->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Guest-Token, X-Requested-With, Accept");
        if (resolved != "*") {
            resp->addHeader("Access-Control-Allow-Credentials", "true");
        }
        resp->addHeader("Access-Control-Max-Age", "86400");
        fcb(resp);
        return;
    }

    fccb();
}

} // namespace middleware
} // namespace mess_manager
