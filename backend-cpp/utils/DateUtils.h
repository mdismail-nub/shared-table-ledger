#pragma once

#include <string>
#include <utility>

namespace mess_manager {
namespace utils {

class DateUtils {
public:
    // Returns current date in local calendar: YYYY-MM-DD
    static std::string getCurrentLocalDate();

    // Returns current month in local calendar: YYYY-MM
    static std::string getCurrentMonth();

    // Returns date range for month (inclusive start, exclusive end):
    // e.g. "2026-11" -> {"2026-11-01", "2026-12-01"}
    static std::pair<std::string, std::string> getMonthRange(const std::string &month);

    // Checks if string matches YYYY-MM-DD format
    static bool isValidDate(const std::string &date);

    // Checks if string matches YYYY-MM format
    static bool isValidMonth(const std::string &month);

    // Formats a date components into YYYY-MM-DD
    static std::string formatDate(int year, int month, int day);
};

} // namespace utils
} // namespace mess_manager
