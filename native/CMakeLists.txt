find_package(Threads REQUIRED)
find_package(MLIR REQUIRED CONFIG PATHS "${KALANDRA_LLVM_ROOT}/lib/cmake/mlir" NO_DEFAULT_PATH)
if(NOT LLVM_PACKAGE_VERSION VERSION_EQUAL KALANDRA_LLVM_VERSION)
  message(FATAL_ERROR "MLIR/LLVM libraries must match ${KALANDRA_LLVM_VERSION}")
endif()
add_executable(kalandra-mlir-check tools/mlir-check.cpp)
target_include_directories(kalandra-mlir-check SYSTEM PRIVATE ${MLIR_INCLUDE_DIRS} ${LLVM_INCLUDE_DIRS})
target_link_libraries(kalandra-mlir-check PRIVATE MLIR LLVM)
target_compile_options(kalandra-mlir-check PRIVATE -Wall -Wextra -Werror)

add_executable(kalandra-proof-cases toolchain-proof/cases.cpp)
target_compile_options(kalandra-proof-cases PRIVATE -Wall -Wextra -Werror -ffp-contract=off)
add_subdirectory(toolchain-proof)

set(KALANDRA_SYNTAX_SOURCES lib/Source.cpp lib/Lexer.cpp lib/Parser.cpp)
add_library(kalandra-syntax STATIC ${KALANDRA_SYNTAX_SOURCES})
target_include_directories(kalandra-syntax PUBLIC include)
target_compile_options(kalandra-syntax PRIVATE -Wall -Wextra -Werror)
add_executable(kalandra-parse tools/parse.cpp)
target_link_libraries(kalandra-parse PRIVATE kalandra-syntax)
target_compile_options(kalandra-parse PRIVATE -Wall -Wextra -Werror)
if(BUILD_TESTING)
  add_executable(kalandra-syntax-tests tests/SyntaxTests.cpp)
  target_link_libraries(kalandra-syntax-tests PRIVATE kalandra-syntax)
  target_compile_options(kalandra-syntax-tests PRIVATE -Wall -Wextra -Werror)
  add_test(NAME frontend-syntax COMMAND kalandra-syntax-tests
    "${PROJECT_SOURCE_DIR}/docs/design/fixtures/cpu-projection.kalandra")
  add_library(kalandra-syntax-sanitized STATIC ${KALANDRA_SYNTAX_SOURCES})
  target_include_directories(kalandra-syntax-sanitized PUBLIC include)
  target_compile_options(kalandra-syntax-sanitized PRIVATE -Wall -Wextra -Werror
    -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
  add_executable(kalandra-syntax-tests-sanitized tests/SyntaxTests.cpp)
  target_link_libraries(kalandra-syntax-tests-sanitized PRIVATE kalandra-syntax-sanitized)
  target_compile_options(kalandra-syntax-tests-sanitized PRIVATE -Wall -Wextra -Werror
    -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
  target_link_options(kalandra-syntax-tests-sanitized PRIVATE
    -fsanitize=address,undefined -fno-sanitize-recover=all)
  add_test(NAME frontend-syntax-sanitized COMMAND kalandra-syntax-tests-sanitized
    "${PROJECT_SOURCE_DIR}/docs/design/fixtures/cpu-projection.kalandra")
  add_test(NAME frontend-cli COMMAND kalandra-parse
    "${PROJECT_SOURCE_DIR}/docs/design/fixtures/cpu-projection.kalandra")
  set_tests_properties(frontend-cli PROPERTIES PASS_REGULAR_EXPRESSION "Parsed 4 functions")
  set_tests_properties(frontend-syntax frontend-syntax-sanitized PROPERTIES TIMEOUT 30)
endif()
if(BUILD_TESTING)
  add_test(NAME frontend-cli-errors
    COMMAND "${CMAKE_COMMAND}" "-DPARSER=$<TARGET_FILE:kalandra-parse>"
      "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}"
      -P "${PROJECT_SOURCE_DIR}/native/cmake/VerifySyntaxRejected.cmake")
endif()

set(KALANDRA_SEMANTIC_SOURCES lib/Semantics.cpp lib/IRDump.cpp)
add_library(kalandra-semantics STATIC ${KALANDRA_SEMANTIC_SOURCES})
target_include_directories(kalandra-semantics SYSTEM PRIVATE ${LLVM_INCLUDE_DIRS})
target_link_libraries(kalandra-semantics PUBLIC kalandra-syntax PRIVATE LLVM)
target_compile_options(kalandra-semantics PRIVATE -Wall -Wextra -Werror)
add_executable(kalandra-check tools/check.cpp)
target_link_libraries(kalandra-check PRIVATE kalandra-semantics)
target_compile_options(kalandra-check PRIVATE -Wall -Wextra -Werror)
if(BUILD_TESTING)
  add_executable(kalandra-semantic-tests tests/SemanticTests.cpp)
  target_link_libraries(kalandra-semantic-tests PRIVATE kalandra-semantics)
  target_compile_options(kalandra-semantic-tests PRIVATE -Wall -Wextra -Werror)
  add_test(NAME frontend-semantics COMMAND kalandra-semantic-tests
    "${PROJECT_SOURCE_DIR}/docs/design/fixtures/cpu-projection.kalandra")
  add_library(kalandra-semantics-sanitized STATIC ${KALANDRA_SEMANTIC_SOURCES})
  target_include_directories(kalandra-semantics-sanitized SYSTEM PRIVATE ${LLVM_INCLUDE_DIRS})
  target_link_libraries(kalandra-semantics-sanitized PUBLIC kalandra-syntax-sanitized PRIVATE LLVM)
  target_compile_options(kalandra-semantics-sanitized PRIVATE -Wall -Wextra -Werror
    -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
  add_executable(kalandra-semantic-tests-sanitized tests/SemanticTests.cpp)
  target_link_libraries(kalandra-semantic-tests-sanitized PRIVATE kalandra-semantics-sanitized)
  target_compile_options(kalandra-semantic-tests-sanitized PRIVATE -Wall -Wextra -Werror
    -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
  target_link_options(kalandra-semantic-tests-sanitized PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
  add_test(NAME frontend-semantics-sanitized COMMAND kalandra-semantic-tests-sanitized
    "${PROJECT_SOURCE_DIR}/docs/design/fixtures/cpu-projection.kalandra")
  add_test(NAME frontend-check-cli COMMAND kalandra-check
    "${PROJECT_SOURCE_DIR}/docs/design/fixtures/cpu-projection.kalandra")
  set_tests_properties(frontend-check-cli PROPERTIES PASS_REGULAR_EXPRESSION "Checked 4 functions")
  set_tests_properties(frontend-semantics frontend-semantics-sanitized PROPERTIES TIMEOUT 30)
endif()
if(BUILD_TESTING)
  add_test(NAME frontend-check-errors
    COMMAND "${CMAKE_COMMAND}" "-DCHECKER=$<TARGET_FILE:kalandra-check>"
      "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}"
      -P "${PROJECT_SOURCE_DIR}/native/cmake/VerifyCheckRejected.cmake")
endif()

add_library(kalandra-backend STATIC lib/Backend.cpp lib/CheckedABI.cpp lib/TaskBackend.cpp)
target_include_directories(kalandra-backend SYSTEM PRIVATE ${MLIR_INCLUDE_DIRS} ${LLVM_INCLUDE_DIRS})
target_link_libraries(kalandra-backend PUBLIC kalandra-semantics PRIVATE MLIR LLVM)
target_compile_options(kalandra-backend PRIVATE -Wall -Wextra -Werror)
add_library(kalandra-native-runtime STATIC runtime/Runtime.cpp runtime/Tasks.cpp runtime/TaskABI.cpp runtime/Entry.cpp)
target_link_libraries(kalandra-native-runtime PUBLIC Threads::Threads)
target_compile_options(kalandra-native-runtime PRIVATE -Wall -Wextra -Werror)
add_library(kalandra-native-runtime-sanitized STATIC runtime/Runtime.cpp runtime/Tasks.cpp runtime/TaskABI.cpp runtime/Entry.cpp)
target_link_libraries(kalandra-native-runtime-sanitized PUBLIC Threads::Threads)
target_compile_options(kalandra-native-runtime-sanitized PRIVATE -Wall -Wextra -Werror
  -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
add_library(kalandra-native-runtime-thread-sanitized STATIC runtime/Runtime.cpp runtime/Tasks.cpp runtime/TaskABI.cpp runtime/Entry.cpp)
target_link_libraries(kalandra-native-runtime-thread-sanitized PUBLIC Threads::Threads)
target_compile_options(kalandra-native-runtime-thread-sanitized PRIVATE -Wall -Wextra -Werror -O1 -g
  -fsanitize=thread -fno-omit-frame-pointer)
add_executable(kalandrac tools/compile.cpp)
target_include_directories(kalandrac SYSTEM PRIVATE ${LLVM_INCLUDE_DIRS})
target_link_libraries(kalandrac PRIVATE kalandra-backend LLVM MLIR)
target_compile_options(kalandrac PRIVATE -Wall -Wextra -Werror)
target_compile_definitions(kalandrac PRIVATE
  KALANDRA_CLANGXX="${CMAKE_CXX_COMPILER}"
  KALANDRA_RUNTIME="$<TARGET_FILE:kalandra-native-runtime>"
  KALANDRA_SANITIZED_RUNTIME="$<TARGET_FILE:kalandra-native-runtime-sanitized>"
  KALANDRA_THREAD_SANITIZED_RUNTIME="$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
add_dependencies(kalandrac kalandra-native-runtime kalandra-native-runtime-sanitized kalandra-native-runtime-thread-sanitized)
if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(SOURCE_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-sanitized>")
    else()
      set(SOURCE_RUNTIME "$<TARGET_FILE:kalandra-native-runtime>")
    endif()
    add_test(NAME native-source-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>" "-DCLANGXX=${CMAKE_CXX_COMPILER}"
        "-DFIXTURE=${PROJECT_SOURCE_DIR}/docs/design/fixtures/cpu-projection.kalandra"
        "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/NativeHarness.cpp"
        "-DRUNTIME=${SOURCE_RUNTIME}" "-DVARIANT=${VARIANT}"
        "-DCASE_DIR=${CMAKE_CURRENT_BINARY_DIR}/toolchain-proof/cases"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/compiled-${VARIANT}"
        -P "${PROJECT_SOURCE_DIR}/native/cmake/VerifyNativeSource.cmake")
    set_tests_properties(native-source-${VARIANT} PROPERTIES TIMEOUT 60)
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized)
    add_executable(kalandra-invocation-tests-${VARIANT} tests/InvocationTests.cpp runtime/Runtime.cpp)
    target_compile_options(kalandra-invocation-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_compile_options(kalandra-invocation-tests-${VARIANT} PRIVATE
        -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-invocation-tests-${VARIANT} PRIVATE
        -fsanitize=address,undefined -fno-sanitize-recover=all)
    endif()
    if(VARIANT STREQUAL "optimized")
      target_compile_options(kalandra-invocation-tests-${VARIANT} PRIVATE -O2)
    endif()
    add_test(NAME native-invocation-${VARIANT} COMMAND kalandra-invocation-tests-${VARIANT})
    set_tests_properties(native-invocation-${VARIANT} PROPERTIES TIMEOUT 30)
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized)
    add_executable(kalandra-task-tests-${VARIANT} tests/TaskTests.cpp runtime/Runtime.cpp runtime/Tasks.cpp)
    target_compile_options(kalandra-task-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_compile_options(kalandra-task-tests-${VARIANT} PRIVATE
        -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-task-tests-${VARIANT} PRIVATE
        -fsanitize=address,undefined -fno-sanitize-recover=all)
    endif()
    if(VARIANT STREQUAL "optimized")
      target_compile_options(kalandra-task-tests-${VARIANT} PRIVATE -O2)
    endif()
    add_test(NAME native-tasks-${VARIANT} COMMAND kalandra-task-tests-${VARIANT})
    set_tests_properties(native-tasks-${VARIANT} PROPERTIES TIMEOUT 30)
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    add_test(NAME native-source-tasks-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DFIXTURES=${CMAKE_CURRENT_SOURCE_DIR}/tests/fixtures" "-DVARIANT=${VARIANT}"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/source-tasks-${VARIANT}"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifySourceTasks.cmake")
    set_tests_properties(native-source-tasks-${VARIANT} PROPERTIES TIMEOUT 60)
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    add_test(NAME native-task-recovery-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DFIXTURES=${CMAKE_CURRENT_SOURCE_DIR}/tests/fixtures" "-DVARIANT=${VARIANT}"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/task-recovery-${VARIANT}"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyTaskRecovery.cmake")
    set_tests_properties(native-task-recovery-${VARIANT} PROPERTIES TIMEOUT 60)
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    add_executable(kalandra-worker-tests-${VARIANT} tests/WorkerTests.cpp runtime/Runtime.cpp runtime/Tasks.cpp)
    target_link_libraries(kalandra-worker-tests-${VARIANT} PRIVATE Threads::Threads)
    target_compile_options(kalandra-worker-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_compile_options(kalandra-worker-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-worker-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
    elseif(VARIANT STREQUAL "thread-sanitized")
      target_compile_options(kalandra-worker-tests-${VARIANT} PRIVATE -O1 -g -fsanitize=thread -fno-omit-frame-pointer)
      target_link_options(kalandra-worker-tests-${VARIANT} PRIVATE -fsanitize=thread)
    elseif(VARIANT STREQUAL "optimized")
      target_compile_options(kalandra-worker-tests-${VARIANT} PRIVATE -O2)
    endif()
    add_test(NAME native-workers-${VARIANT} COMMAND kalandra-worker-tests-${VARIANT})
    set_tests_properties(native-workers-${VARIANT} PROPERTIES TIMEOUT 60)
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    add_test(NAME native-compiled-workers-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>" "-DCLANGXX=${CMAKE_CXX_COMPILER}"
        "-DSOURCE_ROOT=${PROJECT_SOURCE_DIR}" "-DVARIANT=${VARIANT}"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/compiled-workers-${VARIANT}"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyCompiledWorkers.cmake")
    set_tests_properties(native-compiled-workers-${VARIANT} PROPERTIES TIMEOUT 60)
  endforeach()
endif()

if(BUILD_TESTING)
  # Diagnostic probes are excluded from ordinary runtime/performance builds.
  # Validate their counters and synchronization separately under TSan.
  add_executable(kalandra-scheduler-profile-tests
    benchmarks/Scheduler.cpp runtime/Tasks.cpp runtime/Runtime.cpp)
  target_link_libraries(kalandra-scheduler-profile-tests PRIVATE Threads::Threads)
  target_compile_definitions(kalandra-scheduler-profile-tests PRIVATE KALANDRA_TASK_PROFILE)
  target_compile_options(kalandra-scheduler-profile-tests PRIVATE
    -Wall -Wextra -Werror -O1 -g -fsanitize=thread -fno-omit-frame-pointer)
  target_link_options(kalandra-scheduler-profile-tests PRIVATE -fsanitize=thread)
  add_test(NAME native-scheduler-profile-thread-sanitized
    COMMAND kalandra-scheduler-profile-tests 4 128 32 8)
  set_tests_properties(native-scheduler-profile-thread-sanitized PROPERTIES TIMEOUT 30)
endif()
