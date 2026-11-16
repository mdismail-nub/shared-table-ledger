
cmake_minimum_required(VERSION 3.16)

project(mess_manager_backend
    VERSION 1.0.0
    LANGUAGES CXX
)

# ==================================================
# C++ CONFIGURATION
# ==================================================

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(MSVC)
    add_compile_options(/W4 /utf-8)
    add_compile_definitions(_CRT_SECURE_NO_WARNINGS)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

include(FetchContent)

# ==================================================
# POSTGRESQL
# ==================================================

find_package(PostgreSQL REQUIRED)

message(STATUS "PostgreSQL found: ${PostgreSQL_LIBRARIES}")

add_compile_definitions(HAVE_LIBPQ=1)

# ==================================================
# REAL DROGON FRAMEWORK
# ==================================================

find_package(Drogon CONFIG REQUIRED)

if(NOT TARGET Drogon::Drogon)
    message(FATAL_ERROR "Drogon was found, but Drogon::Drogon target is missing.")
endif()

message(STATUS "Real Drogon found: ${Drogon_DIR}")

# ==================================================
# JSONCPP
# ==================================================

find_package(jsoncpp CONFIG QUIET)

if(TARGET JsonCpp::JsonCpp)
    set(JSONCPP_TARGET JsonCpp::JsonCpp)
    message(STATUS "Using JsonCpp::JsonCpp")

elseif(TARGET jsoncpp_lib)
    set(JSONCPP_TARGET jsoncpp_lib)
    message(STATUS "Using jsoncpp_lib")

elseif(TARGET jsoncpp_static)
    set(JSONCPP_TARGET jsoncpp_static)
    message(STATUS "Using jsoncpp_static")

else()
    message(STATUS "System JsonCpp unavailable. Fetching JsonCpp 1.9.5.")

    FetchContent_Declare(
        jsoncpp
        GIT_REPOSITORY https://github.com/open-source-parsers/jsoncpp.git
        GIT_TAG 1.9.5
        GIT_SHALLOW TRUE
    )

    set(JSONCPP_WITH_TESTS OFF CACHE BOOL "" FORCE)
    set(JSONCPP_WITH_POST_BUILD_UNITTEST OFF CACHE BOOL "" FORCE)
    set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
    set(BUILD_STATIC_LIBS ON CACHE BOOL "" FORCE)

    FetchContent_MakeAvailable(jsoncpp)

    if(TARGET JsonCpp::JsonCpp)
        set(JSONCPP_TARGET JsonCpp::JsonCpp)
    elseif(TARGET jsoncpp_static)
        set(JSONCPP_TARGET jsoncpp_static)
    elseif(TARGET jsoncpp_lib)
        set(JSONCPP_TARGET jsoncpp_lib)
    else()
        message(FATAL_ERROR "No usable JsonCpp target was found.")
    endif()
endif()

# ==================================================
# COMMON INCLUDE DIRECTORIES
# IMPORTANT:
# Do not add the local include/ directory here.
# It contains compatibility Drogon headers that
# would shadow the real installed Drogon headers.
# ==================================================

set(COMMON_INCLUDE_DIRS
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/models
    ${CMAKE_CURRENT_SOURCE_DIR}/services
    ${CMAKE_CURRENT_SOURCE_DIR}/repositories
    ${CMAKE_CURRENT_SOURCE_DIR}/validators
    ${CMAKE_CURRENT_SOURCE_DIR}/utils
    ${CMAKE_CURRENT_SOURCE_DIR}/middleware
    ${CMAKE_CURRENT_SOURCE_DIR}/controllers
)

# ==================================================
# COMMON SOURCE FILES
# ==================================================

set(CORE_SOURCES
    utils/Crypto.cpp
    utils/JwtHelper.cpp
    utils/DateUtils.cpp
    utils/CsvHelper.cpp
    validators/InputValidator.cpp
    services/AccountingEngine.cpp
    services/DomainServices.cpp
    services/AuthService.cpp
    services/WorkspaceService.cpp
    repositories/PgClient.cpp
    repositories/DatabaseManager.cpp
)

# ==================================================
# TEST EXECUTABLE
# ==================================================

add_executable(mess_manager_tests
    tests/AccountingEngineTest.cpp
    ${CORE_SOURCES}
)

target_include_directories(mess_manager_tests PRIVATE
    ${COMMON_INCLUDE_DIRS}
)

target_link_libraries(mess_manager_tests PRIVATE
    ${JSONCPP_TARGET}
    PostgreSQL::PostgreSQL
)

if(WIN32)
    target_link_libraries(mess_manager_tests PRIVATE ws2_32)
else()
    target_link_libraries(mess_manager_tests PRIVATE pthread)
endif()

# ==================================================
# PRODUCTION SERVER
# ==================================================

set(SERVER_SOURCES
    main.cpp
    ${CORE_SOURCES}
    middleware/AuthFilter.cpp
    middleware/CorsFilter.cpp
    controllers/AuthController.cpp
    controllers/WorkspaceController.cpp
    controllers/MemberController.cpp
    controllers/MealController.cpp
    controllers/ExpenseController.cpp
    controllers/PaymentController.cpp
    controllers/AccountingController.cpp
    controllers/NotificationController.cpp
    controllers/ReportController.cpp
    controllers/SettingsController.cpp
    controllers/HealthController.cpp
)

add_executable(mess_manager_server
    ${SERVER_SOURCES}
)

target_include_directories(mess_manager_server PRIVATE
    ${COMMON_INCLUDE_DIRS}
)

target_link_libraries(mess_manager_server PRIVATE
    Drogon::Drogon
    ${JSONCPP_TARGET}
    PostgreSQL::PostgreSQL
)

if(WIN32)
    target_link_libraries(mess_manager_server PRIVATE ws2_32)
else()
    target_link_libraries(mess_manager_server PRIVATE pthread)
endif()

# ==================================================
# TESTING
# ==================================================

enable_testing()

add_test(
    NAME AccountingEngineUnitTests
    COMMAND mess_manager_tests
)

# ==================================================
# BUILD INFORMATION
# ==================================================

message(STATUS "======================================")
message(STATUS "Mess Manager Backend Configuration")
message(STATUS "C++ Standard: C++17")
message(STATUS "JSONCpp target: ${JSONCPP_TARGET}")
message(STATUS "PostgreSQL: ENABLED")
message(STATUS "Drogon: ENABLED")
message(STATUS "Production server: mess_manager_server")
message(STATUS "Test executable: mess_manager_tests")
message(STATUS "======================================")
