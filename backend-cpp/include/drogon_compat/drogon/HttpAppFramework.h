#pragma once

#include <iostream>
#include <string>
#include <vector>
#include <unordered_map>
#include <memory>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <queue>
#include <sstream>
#include <algorithm>
#include <atomic>
#include <cstring>
#include <functional>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
using socket_t = SOCKET;
#define IS_INVALID_SOCKET(s) ((s) == INVALID_SOCKET)
#define CLOSE_SOCKET(s) closesocket(s)
#else
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <cxxabi.h>
using socket_t = int;
#define IS_INVALID_SOCKET(s) ((s) < 0)
#define CLOSE_SOCKET(s) close(s)
#endif

#include "HttpTypes.h"
#include "HttpRequest.h"
#include "HttpResponse.h"
#include "HttpFilter.h"
#include <trantor/utils/Logger.h>

namespace drogon {

namespace utils {
inline std::string demangle(const char *name) {
#ifdef _MSC_VER
    std::string s = name;
    if (s.rfind("class ", 0) == 0) s = s.substr(6);
    else if (s.rfind("struct ", 0) == 0) s = s.substr(7);
    return s;
#else
    int status = 0;
    char *demangled = abi::__cxa_demangle(name, nullptr, nullptr, &status);
    if (status == 0 && demangled) {
        std::string res = demangled;
        free(demangled);
        return res;
    }
    return name;
#endif
}
} // namespace utils

using AdviceCallback = std::function<void(const HttpResponsePtr &)>;
using AdviceChainCallback = std::function<void()>;
using PreRoutingAdvice = std::function<void(const HttpRequestPtr &, AdviceCallback &&, AdviceChainCallback &&)>;
using PostHandlingAdvice = std::function<void(const HttpRequestPtr &, const HttpResponsePtr &)>;

struct RouteEntry {
    std::string path;
    HttpMethod method;
    std::vector<std::string> filters;
    std::function<void(const HttpRequestPtr &, std::function<void(const HttpResponsePtr &)> &&, const std::vector<std::string> &)> handler;
};

class HttpAppFramework {
public:
    static HttpAppFramework &instance() {
        static HttpAppFramework inst;
        return inst;
    }

    HttpAppFramework &addListener(const std::string &host, uint16_t port) {
        host_ = host;
        port_ = port;
        return *this;
    }

    HttpAppFramework &setThreadNum(size_t threads) {
        threads_ = threads > 0 ? threads : 1;
        return *this;
    }

    HttpAppFramework &setLogLevel(trantor::Logger::LogLevel level) {
        logLevel_ = static_cast<int>(level);
        return *this;
    }

    HttpAppFramework &registerPreRoutingAdvice(PreRoutingAdvice &&advice) {
        preRoutingAdvices_.push_back(std::move(advice));
        return *this;
    }

    HttpAppFramework &registerPostHandlingAdvice(PostHandlingAdvice &&advice) {
        postHandlingAdvices_.push_back(std::move(advice));
        return *this;
    }

    static void registerFilterCreator(const std::string &name, std::function<std::shared_ptr<HttpFilterBase>()> creator) {
        instance().filterCreators_[name] = creator;
        size_t lastColon = name.rfind("::");
        if (lastColon != std::string::npos) {
            instance().filterCreators_[name.substr(lastColon + 2)] = creator;
        }
    }

    void addRoute(const RouteEntry &entry) {
        routes_.push_back(entry);
    }

    void run() {
#ifdef _WIN32
        WSADATA wsaData;
        if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
            std::cerr << "[Drogon] Failed to initialize Winsock.\n";
            return;
        }
#endif

        socket_t serverSock = socket(AF_INET, SOCK_STREAM, 0);
        if (IS_INVALID_SOCKET(serverSock)) {
            std::cerr << "[Drogon] Failed to create socket.\n";
            return;
        }

        int opt = 1;
#ifdef _WIN32
        setsockopt(serverSock, SOL_SOCKET, SO_REUSEADDR, (const char *)&opt, sizeof(opt));
#else
        setsockopt(serverSock, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

        sockaddr_in addr{};
        addr.sin_family = AF_INET;
        addr.sin_port = htons(port_);
        if (host_ == "0.0.0.0" || host_.empty()) {
            addr.sin_addr.s_addr = INADDR_ANY;
        } else {
            inet_pton(AF_INET, host_.c_str(), &addr.sin_addr);
        }

        if (bind(serverSock, (sockaddr *)&addr, sizeof(addr)) != 0) {
            std::cerr << "[Drogon] Failed to bind to " << host_ << ":" << port_ << "\n";
            CLOSE_SOCKET(serverSock);
            return;
        }

        if (listen(serverSock, SOMAXCONN) != 0) {
            std::cerr << "[Drogon] Failed to listen on socket.\n";
            CLOSE_SOCKET(serverSock);
            return;
        }

        running_ = true;

        for (size_t i = 0; i < threads_; ++i) {
            workers_.emplace_back(&HttpAppFramework::workerLoop, this);
        }

        while (running_) {
            sockaddr_in clientAddr{};
#ifdef _WIN32
            int addrLen = sizeof(clientAddr);
#else
            socklen_t addrLen = sizeof(clientAddr);
#endif
            socket_t clientSock = accept(serverSock, (sockaddr *)&clientAddr, &addrLen);
            if (IS_INVALID_SOCKET(clientSock)) {
                if (!running_) break;
                continue;
            }

            {
                std::lock_guard<std::mutex> lock(queueMutex_);
                clientQueue_.push(clientSock);
            }
            queueCv_.notify_one();
        }

        CLOSE_SOCKET(serverSock);
#ifdef _WIN32
        WSACleanup();
#endif
    }

    void stop() {
        running_ = false;
        queueCv_.notify_all();
        for (auto &t : workers_) {
            if (t.joinable()) t.join();
        }
    }

private:
    HttpAppFramework() : host_("0.0.0.0"), port_(8080), threads_(4), logLevel_(0), running_(false) {}
    ~HttpAppFramework() {
        stop();
    }

    void workerLoop() {
        while (running_) {
            socket_t clientSock;
            {
                std::unique_lock<std::mutex> lock(queueMutex_);
                queueCv_.wait(lock, [this]() { return !clientQueue_.empty() || !running_; });
                if (!running_ && clientQueue_.empty()) return;
                clientSock = clientQueue_.front();
                clientQueue_.pop();
            }

            handleClient(clientSock);
            CLOSE_SOCKET(clientSock);
        }
    }

    std::string resolveAllowedOrigin(const std::string &origin) {
        std::string clean = origin;
        size_t first = clean.find_first_not_of(" \t\r\n");
        if (first != std::string::npos) {
            size_t last = clean.find_last_not_of(" \t\r\n");
            clean = clean.substr(first, (last - first + 1));
        }

        const char *envCorsList = std::getenv("CORS_ALLOWED_ORIGINS");
        if (!envCorsList) envCorsList = std::getenv("CORS_ORIGIN");

        const char *appEnv = std::getenv("APP_ENV");
        bool isDev = (!appEnv || std::string(appEnv) != "production");

        if (isDev && !clean.empty()) {
            if (clean.rfind("http://localhost:", 0) == 0 ||
                clean.rfind("http://127.0.0.1:", 0) == 0 ||
                clean == "http://localhost" ||
                clean == "http://127.0.0.1") {
                return clean;
            }
        }

        if (envCorsList) {
            std::string listStr = envCorsList;
            std::istringstream iss(listStr);
            std::string item;
            while (std::getline(iss, item, ',')) {
                size_t f = item.find_first_not_of(" \t\r\n");
                if (f != std::string::npos) {
                    size_t l = item.find_last_not_of(" \t\r\n");
                    item = item.substr(f, (l - f + 1));
                }
                if (item == "*" || item == clean) {
                    return clean.empty() ? item : clean;
                }
            }
        }

        if (clean == "https://shared-table-ledger.vercel.app") {
            return clean;
        }

        return !clean.empty() ? clean : "*";
    }

    void handleClient(socket_t sock) {
#ifdef _WIN32
        DWORD timeout = 3000;
        setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, (const char *)&timeout, sizeof(timeout));
#else
        struct timeval tv;
        tv.tv_sec = 3;
        tv.tv_usec = 0;
        setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
#endif

        std::string rawRequest;
        char buffer[4096];
        int bytesRead = 0;

        while ((bytesRead = recv(sock, buffer, sizeof(buffer), 0)) > 0) {
            rawRequest.append(buffer, bytesRead);
            if (rawRequest.find("\r\n\r\n") != std::string::npos) {
                size_t headerEnd = rawRequest.find("\r\n\r\n");
                std::string headerPart = rawRequest.substr(0, headerEnd);
                size_t clPos = headerPart.find("Content-Length:");
                if (clPos == std::string::npos) clPos = headerPart.find("content-length:");
                if (clPos != std::string::npos) {
                    size_t lineEnd = headerPart.find("\r\n", clPos);
                    std::string clVal = headerPart.substr(clPos + 15, lineEnd - (clPos + 15));
                    size_t contentLen = 0;
                    try {
                        contentLen = std::stoul(clVal);
                    } catch (...) {}
                    size_t bodyReceived = rawRequest.length() - (headerEnd + 4);
                    if (bodyReceived < contentLen) {
                        while (bodyReceived < contentLen && (bytesRead = recv(sock, buffer, sizeof(buffer), 0)) > 0) {
                            rawRequest.append(buffer, bytesRead);
                            bodyReceived += bytesRead;
                        }
                    }
                }
                break;
            }
        }

        if (rawRequest.empty()) return;

        auto req = parseHttpRequest(rawRequest);
        if (!req) {
            sendResponse(sock, HttpResponse::newHttpJsonResponse(Json::Value("Bad Request")), k400BadRequest);
            return;
        }

        // Execute Pre-Routing Advices (e.g. Global CORS Preflight handling)
        bool adviceHandled = false;
        for (const auto &advice : preRoutingAdvices_) {
            advice(
                req,
                [this, sock, req, &adviceHandled](const HttpResponsePtr &resp) {
                    sendResponse(sock, resp, resp ? resp->getStatusCode() : k200OK, req);
                    adviceHandled = true;
                },
                []() {}
            );
            if (adviceHandled) return;
        }

        // Handle CORS Preflight OPTIONS globally if unhandled
        if (req->method() == HttpMethod::Options) {
            std::string origin = req->getHeader("Origin");
            if (origin.empty()) origin = req->getHeader("origin");
            std::string allowedOrigin = resolveAllowedOrigin(origin);

            auto optionsResp = HttpResponse::newHttpResponse();
            optionsResp->setStatusCode(k204NoContent);
            optionsResp->addHeader("Access-Control-Allow-Origin", allowedOrigin);
            optionsResp->addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
            optionsResp->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Guest-Token, X-Requested-With, Accept");
            if (allowedOrigin != "*") {
                optionsResp->addHeader("Access-Control-Allow-Credentials", "true");
            }
            optionsResp->addHeader("Access-Control-Max-Age", "86400");
            sendResponse(sock, optionsResp, k204NoContent, req);
            return;
        }

        // Match Route
        std::vector<std::string> pathParams;
        const RouteEntry *matchedRoute = findRoute(req->method(), req->path(), pathParams);

        if (!matchedRoute) {
            Json::Value errJson;
            errJson["error"] = "Not Found: " + req->path();
            auto notFound = HttpResponse::newHttpJsonResponse(errJson);
            notFound->setStatusCode(k404NotFound);
            sendResponse(sock, notFound, k404NotFound, req);
            return;
        }

        // Execute Filter Chain & Handler
        executeFilterChain(req, *matchedRoute, pathParams, [this, sock, req](const HttpResponsePtr &resp) {
            sendResponse(sock, resp, resp ? resp->getStatusCode() : k200OK, req);
        });
    }

    std::shared_ptr<HttpRequest> parseHttpRequest(const std::string &raw) {
        std::istringstream stream(raw);
        std::string requestLine;
        if (!std::getline(stream, requestLine)) return nullptr;
        if (!requestLine.empty() && requestLine.back() == '\r') requestLine.pop_back();

        std::istringstream lineStream(requestLine);
        std::string methodStr, urlStr, httpVer;
        if (!(lineStream >> methodStr >> urlStr >> httpVer)) return nullptr;

        auto req = std::make_shared<HttpRequest>();
        if (methodStr == "GET") req->setMethod(HttpMethod::Get);
        else if (methodStr == "POST") req->setMethod(HttpMethod::Post);
        else if (methodStr == "PUT") req->setMethod(HttpMethod::Put);
        else if (methodStr == "DELETE") req->setMethod(HttpMethod::Delete);
        else if (methodStr == "OPTIONS") req->setMethod(HttpMethod::Options);
        else if (methodStr == "HEAD") req->setMethod(HttpMethod::Head);
        else req->setMethod(HttpMethod::Get);

        size_t qPos = urlStr.find('?');
        if (qPos != std::string::npos) {
            req->setPath(urlStr.substr(0, qPos));
            std::string query = urlStr.substr(qPos + 1);
            std::istringstream qStream(query);
            std::string pair;
            while (std::getline(qStream, pair, '&')) {
                size_t eqPos = pair.find('=');
                if (eqPos != std::string::npos) {
                    req->setParameter(urlDecode(pair.substr(0, eqPos)), urlDecode(pair.substr(eqPos + 1)));
                } else if (!pair.empty()) {
                    req->setParameter(urlDecode(pair), "");
                }
            }
        } else {
            req->setPath(urlStr);
        }

        std::string headerLine;
        while (std::getline(stream, headerLine) && headerLine != "\r" && !headerLine.empty()) {
            if (headerLine.back() == '\r') headerLine.pop_back();
            size_t colon = headerLine.find(':');
            if (colon != std::string::npos) {
                std::string k = headerLine.substr(0, colon);
                std::string v = headerLine.substr(colon + 1);
                size_t first = v.find_first_not_of(" \t");
                if (first != std::string::npos) v = v.substr(first);
                req->setHeader(k, v);
            }
        }

        std::string body;
        while (std::getline(stream, headerLine)) {
            body += headerLine;
            if (!stream.eof()) body += "\n";
        }
        req->setBody(body);
        return req;
    }

    const RouteEntry *findRoute(HttpMethod method, const std::string &path, std::vector<std::string> &outParams) {
        for (const auto &route : routes_) {
            if (route.method != method) continue;
            if (matchPattern(route.path, path, outParams)) {
                return &route;
            }
        }
        return nullptr;
    }

    bool matchPattern(const std::string &pattern, const std::string &path, std::vector<std::string> &outParams) {
        outParams.clear();
        if (pattern == path) return true;

        if (pattern.length() >= 2 && pattern.substr(pattern.length() - 2) == "/*") {
            std::string prefix = pattern.substr(0, pattern.length() - 2);
            if (path.rfind(prefix, 0) == 0) return true;
        }

        std::vector<std::string> patSegs = splitPath(pattern);
        std::vector<std::string> pathSegs = splitPath(path);

        if (patSegs.size() != pathSegs.size()) return false;

        for (size_t i = 0; i < patSegs.size(); ++i) {
            if (!patSegs[i].empty() && patSegs[i].front() == '{' && patSegs[i].back() == '}') {
                outParams.push_back(pathSegs[i]);
            } else if (patSegs[i] != pathSegs[i]) {
                outParams.clear();
                return false;
            }
        }
        return true;
    }

    std::vector<std::string> splitPath(const std::string &p) {
        std::vector<std::string> segs;
        std::istringstream stream(p);
        std::string seg;
        while (std::getline(stream, seg, '/')) {
            if (!seg.empty()) segs.push_back(seg);
        }
        return segs;
    }

    void executeFilterChain(
        const HttpRequestPtr &req,
        const RouteEntry &route,
        const std::vector<std::string> &params,
        std::function<void(const HttpResponsePtr &)> onDone
    ) {
        size_t currentFilterIdx = 0;
        runNextFilter(req, route, params, currentFilterIdx, std::move(onDone));
    }

    std::shared_ptr<HttpFilterBase> getOrCreateFilter(const std::string &name) {
        std::lock_guard<std::mutex> lock(filterMutex_);
        auto it = filters_.find(name);
        if (it != filters_.end()) return it->second;

        auto creatorIt = filterCreators_.find(name);
        if (creatorIt != filterCreators_.end()) {
            auto inst = creatorIt->second();
            filters_[name] = inst;
            return inst;
        }

        return nullptr;
    }

    void runNextFilter(
        const HttpRequestPtr &req,
        const RouteEntry &route,
        const std::vector<std::string> &params,
        size_t idx,
        std::function<void(const HttpResponsePtr &)> onDone
    ) {
        if (idx >= route.filters.size()) {
            route.handler(req, std::move(onDone), params);
            return;
        }

        const std::string &filterName = route.filters[idx];
        std::shared_ptr<HttpFilterBase> filter = getOrCreateFilter(filterName);

        if (!filter) {
            runNextFilter(req, route, params, idx + 1, std::move(onDone));
            return;
        }

        filter->doFilter(
            req,
            [onDone](const HttpResponsePtr &errResp) {
                onDone(errResp);
            },
            [this, req, &route, params, idx, onDone]() {
                runNextFilter(req, route, params, idx + 1, onDone);
            }
        );
    }

    void sendResponse(socket_t sock, const HttpResponsePtr &resp, HttpStatusCode code, const HttpRequestPtr &req = nullptr) {
        if (!resp) return;

        // Execute Post-Handling Advices (e.g. Global CORS headers)
        for (const auto &advice : postHandlingAdvices_) {
            advice(req, resp);
        }

        std::string statusText = "OK";
        int statusCode = static_cast<int>(code);
        switch (statusCode) {
            case 200: statusText = "OK"; break;
            case 201: statusText = "Created"; break;
            case 204: statusText = "No Content"; break;
            case 400: statusText = "Bad Request"; break;
            case 401: statusText = "Unauthorized"; break;
            case 403: statusText = "Forbidden"; break;
            case 404: statusText = "Not Found"; break;
            case 500: statusText = "Internal Server Error"; break;
            default: statusText = "OK"; break;
        }

        std::string origin = req ? req->getHeader("Origin") : "";
        if (origin.empty() && req) origin = req->getHeader("origin");
        std::string allowedOrigin = resolveAllowedOrigin(origin);

        std::ostringstream ss;
        ss << "HTTP/1.1 " << statusCode << " " << statusText << "\r\n";
        
        bool hasCors = false;
        for (const auto &[k, v] : resp->headers()) {
            if (k == "Access-Control-Allow-Origin") hasCors = true;
            ss << k << ": " << v << "\r\n";
        }
        if (!hasCors) {
            ss << "Access-Control-Allow-Origin: " << allowedOrigin << "\r\n";
            ss << "Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH\r\n";
            ss << "Access-Control-Allow-Headers: Content-Type, Authorization, X-Guest-Token, X-Requested-With, Accept\r\n";
            if (allowedOrigin != "*") {
                ss << "Access-Control-Allow-Credentials: true\r\n";
            }
            ss << "Access-Control-Max-Age: 86400\r\n";
        }

        ss << "Content-Length: " << resp->body().length() << "\r\n";
        ss << "Connection: close\r\n\r\n";
        ss << resp->body();

        std::string resStr = ss.str();
        send(sock, resStr.c_str(), static_cast<int>(resStr.length()), 0);
    }

    std::string urlDecode(const std::string &str) {
        std::string result;
        for (size_t i = 0; i < str.length(); ++i) {
            if (str[i] == '+') {
                result += ' ';
            } else if (str[i] == '%' && i + 2 < str.length()) {
                int value = 0;
                std::istringstream is(str.substr(i + 1, 2));
                if (is >> std::hex >> value) {
                    result += static_cast<char>(value);
                    i += 2;
                } else {
                    result += '%';
                }
            } else {
                result += str[i];
            }
        }
        return result;
    }

    std::string host_;
    uint16_t port_;
    size_t threads_;
    int logLevel_;
    std::atomic<bool> running_;

    std::vector<RouteEntry> routes_;
    std::mutex filterMutex_;
    std::unordered_map<std::string, std::shared_ptr<HttpFilterBase>> filters_;
    std::unordered_map<std::string, std::function<std::shared_ptr<HttpFilterBase>()>> filterCreators_;

    std::vector<PreRoutingAdvice> preRoutingAdvices_;
    std::vector<PostHandlingAdvice> postHandlingAdvices_;

    std::queue<socket_t> clientQueue_;
    std::mutex queueMutex_;
    std::condition_variable queueCv_;
    std::vector<std::thread> workers_;
};

inline HttpAppFramework &app() {
    return HttpAppFramework::instance();
}

} // namespace drogon

#include "HttpController.h"
