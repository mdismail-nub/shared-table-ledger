#pragma once

#include <iostream>
#include <string>

namespace trantor {
class Logger {
public:
    enum LogLevel {
        kTrace = 0,
        kDebug,
        kInfo,
        kWarn,
        kError,
        kFatal
    };

    static void setLogLevel(LogLevel) {}
};
}
