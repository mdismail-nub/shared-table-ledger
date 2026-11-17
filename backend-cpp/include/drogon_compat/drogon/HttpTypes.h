#pragma once

#include <string>

namespace drogon {

enum HttpMethod {
    Get = 0,
    Post,
    Head,
    Put,
    Delete,
    Options,
    Patch
};

enum HttpStatusCode {
    kUnknown = 0,
    k100Continue = 100,
    k200OK = 200,
    k201Created = 201,
    k202Accepted = 202,
    k204NoContent = 204,
    k301MovedPermanently = 301,
    k302Found = 302,
    k304NotModified = 304,
    k400BadRequest = 400,
    k401Unauthorized = 401,
    k403Forbidden = 403,
    k404NotFound = 404,
    k405MethodNotAllowed = 405,
    k500InternalServerError = 500,
    k501NotImplemented = 501,
    k502BadGateway = 502,
    k503ServiceUnavailable = 503
};

enum class ContentType {
    CT_NONE = 0,
    CT_APPLICATION_JSON,
    CT_TEXT_PLAIN,
    CT_TEXT_HTML,
    CT_APPLICATION_XML,
    CT_APPLICATION_X_WWW_FORM_URLENCODED,
    CT_MULTIPART_FORM_DATA,
    CT_CUSTOM
};

} // namespace drogon
