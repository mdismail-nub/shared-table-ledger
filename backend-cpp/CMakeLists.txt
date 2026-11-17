cmake_minimum_required(VERSION 3.16)
project(mess_manager_backend VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Compiler optimization and warnings
if(MSVC)
    add_compile_options(/W4 /utf-8)
    add_compile_definitions(_CRT_SECURE_NO_WARNINGS)
else()
    add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# Find PostgreSQL libpq (Linux/Docker and systems with libpq installed)
find_package(PostgreSQL QUIET)
if(PostgreSQL_FOUND)
    message(STATUS "PostgreSQL libpq found: ${PostgreSQL_LIBRARIES}")
    add_compile_definitions(HAVE_LIBPQ=1)
    include_directories(${PostgreSQL_INCLUDE_DIRS})
    set(PG_LINK_LIBS ${PostgreSQL_LIBRARIES})
else()
    message(STATUS "PostgreSQL libpq not found on host. Local builds will use in-memory store.")
    set(PG_LINK_LIBS "")
endif()

# Find Drogon (optional in environment with Drogon installed)
find_package(Drogon QUIET)
if(Drogon_FOUND)
    message(STATUS "Drogon found: ${Drogon_DIR}")
    add_compile_definitions(HAVE_DROGON=1)
    set(DROGON_LINK_LIBS Drogon::Drogon)
    set(DROGON_COMPAT_INCLUDE_DIRS "")
else()
    message(STATUS "Drogon not installed globally. Using embedded Drogon-compatible framework.")
    set(DROGON_LINK_LIBS "")
    set(DROGON_COMPAT_INCLUDE_DIRS ${CMAKE_CURRENT_SOURCE_DIR}/include/drogon_compat)
endif()

include(FetchContent)

# 1. JsonCpp dependency (Found locally or fetched automatically)
find_package(jsoncpp QUIET)
if(NOT jsoncpp_FOUND)
    message(STATUS "Fetching JsonCpp...")
    FetchContent_Declare(
        jsoncpp
        GIT_REPOSITORY https://github.com/open-source-parsers/jsoncpp.git
        GIT_TAG 1.9.5
    )
    set(JSONCPP_WITH_TESTS OFF CACHE BOOL "" FORCE)
    set(JSONCPP_WITH_POST_BUILD_UNITTEST OFF CACHE BOOL "" FORCE)
    set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
    set(BUILD_STATIC_LIBS ON CACHE BOOL "" FORCE)
    FetchContent_MakeAvailable(jsoncpp)
endif()

# Include directories
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${DROGON_COMPAT_INCLUDE_DIRS}
    ${CMAKE_CURRENT_SOURCE_DIR}/models
    ${CMAKE_CURRENT_SOURCE_DIR}/services
    ${CMAKE_CURRENT_SOURCE_DIR}/repositories
    ${CMAKE_CURRENT_SOURCE_DIR}/validators
    ${CMAKE_CURRENT_SOURCE_DIR}/utils
    ${CMAKE_CURRENT_SOURCE_DIR}/middleware
    ${CMAKE_CURRENT_SOURCE_DIR}/controllers
)

# Common Core Sources (Shared by Server and Test Runner)
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

# 1. Automated Test Executable (Standalone zero-dependency test runner)
add_executable(mess_manager_tests
    tests/AccountingEngineTest.cpp
    ${CORE_SOURCES}
)

if(WIN32)
    target_link_libraries(mess_manager_tests PRIVATE jsoncpp_static ws2_32 ${PG_LINK_LIBS})
else()
    target_link_libraries(mess_manager_tests PRIVATE jsoncpp_static pthread ${PG_LINK_LIBS})
endif()

# 2. Main C++ Server Executable
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

add_executable(mess_manager_server ${SERVER_SOURCES})
if(WIN32)
    target_link_libraries(mess_manager_server PRIVATE jsoncpp_static ws2_32 ${PG_LINK_LIBS} ${DROGON_LINK_LIBS})
else()
    target_link_libraries(mess_manager_server PRIVATE jsoncpp_static pthread ${PG_LINK_LIBS} ${DROGON_LINK_LIBS})
endif()

# Enable CTest
enable_testing()
add_test(NAME AccountingEngineUnitTests COMMAND mess_manager_tests)
