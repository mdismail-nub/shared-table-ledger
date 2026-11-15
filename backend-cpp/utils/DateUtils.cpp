#include "DateUtils.h"
#include <ctime>
#include <sstream>
#include <iomanip>
#include <regex>

namespace mess_manager {
namespace utils {

std::string DateUtils::getCurrentLocalDate() {
    std::time_t t = std::time(nullptr);
    std::tm tm{};
#if defined(_MSC_VER)
    localtime_s(&tm, &t);
#else
    localtime_r(&t, &tm);
#endif
    return formatDate(tm.tm_year + 1900, tm.tm_mon + 1, tm.tm_mday);
}

std::string DateUtils::getCurrentMonth() {
    std::time_t t = std::time(nullptr);
    std::tm tm{};
#if defined(_MSC_VER)
    localtime_s(&tm, &t);
#else
    localtime_r(&t, &tm);
#endif
    std::ostringstream oss;
    oss << (tm.tm_year + 1900) << "-"
        << std::setw(2) << std::setfill('0') << (tm.tm_mon + 1);
    return oss.str();
}

std::pair<std::string, std::string> DateUtils::getMonthRange(const std::string &month) {
    if (!isValidMonth(month)) {
        return {getCurrentMonth() + "-01", getCurrentMonth() + "-31"};
    }
    int year = std::stoi(month.substr(0, 4));
    int mon = std::stoi(month.substr(5, 2));

    std::string start = formatDate(year, mon, 1);
    std::string end;
    if (mon == 12) {
        end = formatDate(year + 1, 1, 1);
    } else {
        end = formatDate(year, mon + 1, 1);
    }
    return {start, end};
}

bool DateUtils::isValidDate(const std::string &date) {
    static const std::regex datePattern(R"(^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$)");
    return std::regex_match(date, datePattern);
}

bool DateUtils::isValidMonth(const std::string &month) {
    static const std::regex monthPattern(R"(^\d{4}-(0[1-9]|1[0-2])$)");
    return std::regex_match(month, monthPattern);
}

std::string DateUtils::formatDate(int year, int month, int day) {
    std::ostringstream oss;
    oss << std::setw(4) << std::setfill('0') << year << "-"
        << std::setw(2) << std::setfill('0') << month << "-"
        << std::setw(2) << std::setfill('0') << day;
    return oss.str();
}

} // namespace utils
} // namespace mess_manager
