#include "ReportController.h"
#include "../services/DomainServices.h"
#include "../utils/DateUtils.h"
#include <drogon/drogon.h>

namespace mess_manager {
namespace controllers {

void ReportController::optionsHandler(
    const drogon::HttpRequestPtr &/*req*/,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    auto resp = drogon::HttpResponse::newHttpResponse();
    resp->setStatusCode(drogon::k204NoContent);
    resp->addHeader("Access-Control-Allow-Origin", "*");
    resp->addHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    resp->addHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Guest-Token");
    callback(resp);
}

void ReportController::getCsvReport(
    const drogon::HttpRequestPtr &req,
    std::function<void(const drogon::HttpResponsePtr &)> &&callback
) {
    std::string messId = req->attributes()->get<std::string>("messId");
    std::string month = req->getParameter("month");
    if (month.empty() || !utils::DateUtils::isValidMonth(month)) {
        month = utils::DateUtils::getCurrentMonth();
    }

    std::string csvData = services::ReportService::exportCsv(messId, month);

    auto resp = drogon::HttpResponse::newHttpResponse();
    resp->setStatusCode(drogon::k200OK);
    resp->setContentTypeCode(drogon::ContentType::CT_TEXT_PLAIN);
    resp->addHeader("Content-Type", "text/csv; charset=utf-8");
    resp->addHeader("Content-Disposition", "attachment; filename=\"mess-manager-" + month + ".csv\"");
    resp->setBody(std::move(csvData));
    callback(resp);
}

} // namespace controllers
} // namespace mess_manager
