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

set(KALANDRA_SYNTAX_SOURCES lib/Source.cpp lib/Lexer.cpp lib/Parser.cpp lib/Modules.cpp)
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

set(KALANDRA_SEMANTIC_SOURCES lib/Semantics.cpp lib/IRDump.cpp lib/Continuation.cpp)
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

add_library(kalandra-strict-float STATIC lib/StrictFloat.cpp)
target_include_directories(kalandra-strict-float PUBLIC include)
target_include_directories(kalandra-strict-float SYSTEM PUBLIC ${MLIR_INCLUDE_DIRS} ${LLVM_INCLUDE_DIRS})
target_compile_options(kalandra-strict-float PRIVATE -Wall -Wextra -Werror)
target_link_libraries(kalandra-strict-float PUBLIC MLIR LLVM)

add_library(kalandra-backend STATIC lib/Backend.cpp lib/CheckedABI.cpp lib/TaskBackend.cpp lib/NumericConversion.cpp)
target_include_directories(kalandra-backend SYSTEM PRIVATE ${MLIR_INCLUDE_DIRS} ${LLVM_INCLUDE_DIRS})
target_link_libraries(kalandra-backend PUBLIC kalandra-semantics PRIVATE kalandra-strict-float MLIR LLVM)
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
    set_tests_properties(native-source-${VARIANT} PROPERTIES TIMEOUT 120)
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

option(KALANDRA_BUILD_METAL_PROOF "Build the isolated Apple GPU toolchain proof" OFF)
if(KALANDRA_BUILD_METAL_PROOF)
  add_subdirectory(metal-proof)
endif()

# Keep optimized external/Metal tests optimized through the scheduler boundary.
add_library(kalandra-task-core-optimized STATIC EXCLUDE_FROM_ALL runtime/Runtime.cpp runtime/Tasks.cpp)
target_compile_options(kalandra-task-core-optimized PRIVATE -Wall -Wextra -Werror -O2)
target_link_libraries(kalandra-task-core-optimized PUBLIC Threads::Threads)

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(EXTERNAL_RUNTIME kalandra-native-runtime-sanitized)
      set(EXTERNAL_FLAGS -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(EXTERNAL_RUNTIME kalandra-native-runtime-thread-sanitized)
      set(EXTERNAL_FLAGS -O1 -g -fsanitize=thread -fno-omit-frame-pointer)
    elseif(VARIANT STREQUAL "optimized")
      set(EXTERNAL_RUNTIME kalandra-task-core-optimized)
      set(EXTERNAL_FLAGS -O2)
    else()
      set(EXTERNAL_RUNTIME kalandra-native-runtime)
      set(EXTERNAL_FLAGS -O0)
    endif()
    add_executable(kalandra-external-tests-${VARIANT} tests/ExternalTaskTests.cpp)
    target_link_libraries(kalandra-external-tests-${VARIANT} PRIVATE ${EXTERNAL_RUNTIME})
    target_compile_options(kalandra-external-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror ${EXTERNAL_FLAGS})
    target_link_options(kalandra-external-tests-${VARIANT} PRIVATE ${EXTERNAL_FLAGS})
    add_test(NAME native-external-${VARIANT} COMMAND kalandra-external-tests-${VARIANT})
    set_tests_properties(native-external-${VARIANT} PROPERTIES TIMEOUT 30)
  endforeach()
endif()

option(KALANDRA_BUILD_METAL_RUNTIME "Build the Apple device and transfer runtime" OFF)
if(KALANDRA_BUILD_METAL_RUNTIME)
  add_subdirectory(metal)
endif()

if(KALANDRA_BUILD_METAL_PROOF AND KALANDRA_BUILD_METAL_RUNTIME)
  add_subdirectory(metal-source)
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(LEASE_RUNTIME kalandra-native-runtime-sanitized)
      set(LEASE_FLAGS -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(LEASE_RUNTIME kalandra-native-runtime-thread-sanitized)
      set(LEASE_FLAGS -O1 -g -fsanitize=thread -fno-omit-frame-pointer)
    elseif(VARIANT STREQUAL "optimized")
      set(LEASE_RUNTIME kalandra-task-core-optimized)
      set(LEASE_FLAGS -O2)
    else()
      set(LEASE_RUNTIME kalandra-native-runtime)
      set(LEASE_FLAGS -O0)
    endif()
    add_executable(kalandra-allocation-lease-${VARIANT} tests/AllocationLeaseTests.cpp)
    target_link_libraries(kalandra-allocation-lease-${VARIANT} PRIVATE ${LEASE_RUNTIME})
    target_compile_options(kalandra-allocation-lease-${VARIANT} PRIVATE -Wall -Wextra -Werror ${LEASE_FLAGS})
    target_link_options(kalandra-allocation-lease-${VARIANT} PRIVATE ${LEASE_FLAGS})
    add_test(NAME native-allocation-lease-${VARIANT} COMMAND kalandra-allocation-lease-${VARIANT})
    set_tests_properties(native-allocation-lease-${VARIANT} PROPERTIES TIMEOUT 30)
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug sanitized)
    add_executable(kalandra-placement-tests-${VARIANT} tests/PlacementTests.cpp)
    target_compile_options(kalandra-placement-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_link_libraries(kalandra-placement-tests-${VARIANT} PRIVATE kalandra-semantics-sanitized kalandra-backend)
      target_compile_options(kalandra-placement-tests-${VARIANT} PRIVATE -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-placement-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
    else()
      target_link_libraries(kalandra-placement-tests-${VARIANT} PRIVATE kalandra-backend)
    endif()
    add_test(NAME frontend-placement-${VARIANT} COMMAND kalandra-placement-tests-${VARIANT} "${PROJECT_SOURCE_DIR}")
    set_tests_properties(frontend-placement-${VARIANT} PROPERTIES TIMEOUT 60)
  endforeach()
endif()

if(BUILD_TESTING)
  add_test(NAME native-explicit-shape-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/explicit-shape-cli"
    -P "${PROJECT_SOURCE_DIR}/native/cmake/VerifyExplicitShapes.cmake")
  set_tests_properties(native-explicit-shape-cli PROPERTIES TIMEOUT 90)
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug sanitized)
    add_executable(kalandra-continuation-tests-${VARIANT} tests/ContinuationTests.cpp)
    target_compile_options(kalandra-continuation-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_link_libraries(kalandra-continuation-tests-${VARIANT} PRIVATE kalandra-semantics-sanitized)
      target_compile_options(kalandra-continuation-tests-${VARIANT} PRIVATE -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-continuation-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
    else()
      target_link_libraries(kalandra-continuation-tests-${VARIANT} PRIVATE kalandra-semantics)
    endif()
    add_test(NAME frontend-continuation-${VARIANT} COMMAND kalandra-continuation-tests-${VARIANT} "${PROJECT_SOURCE_DIR}")
    set_tests_properties(frontend-continuation-${VARIANT} PROPERTIES TIMEOUT 60)
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug sanitized)
    add_executable(kalandra-numeric-type-tests-${VARIANT} tests/NumericTypeTests.cpp)
    target_compile_options(kalandra-numeric-type-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_link_libraries(kalandra-numeric-type-tests-${VARIANT} PRIVATE kalandra-semantics-sanitized kalandra-backend)
      target_compile_options(kalandra-numeric-type-tests-${VARIANT} PRIVATE -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-numeric-type-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
    else()
      target_link_libraries(kalandra-numeric-type-tests-${VARIANT} PRIVATE kalandra-backend)
    endif()
    add_test(NAME native-numeric-types-${VARIANT} COMMAND kalandra-numeric-type-tests-${VARIANT})
    set_tests_properties(native-numeric-types-${VARIANT} PROPERTIES TIMEOUT 60)
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "debug")
      set(STORAGE_RUNTIME kalandra-native-runtime)
      set(STORAGE_FLAGS -O0)
    elseif(VARIANT STREQUAL "optimized")
      set(STORAGE_RUNTIME kalandra-task-core-optimized)
      set(STORAGE_FLAGS -O2)
    elseif(VARIANT STREQUAL "sanitized")
      set(STORAGE_RUNTIME kalandra-native-runtime-sanitized)
      set(STORAGE_FLAGS -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
    else()
      set(STORAGE_RUNTIME kalandra-native-runtime-thread-sanitized)
      set(STORAGE_FLAGS -O1 -g -fsanitize=thread -fno-omit-frame-pointer)
    endif()
    add_executable(kalandra-cpu-storage-tests-${VARIANT} tests/CpuStorageTests.cpp)
    target_compile_options(kalandra-cpu-storage-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror ${STORAGE_FLAGS})
    target_link_options(kalandra-cpu-storage-tests-${VARIANT} PRIVATE ${STORAGE_FLAGS})
    target_link_libraries(kalandra-cpu-storage-tests-${VARIANT} PRIVATE ${STORAGE_RUNTIME})
    add_test(NAME native-cpu-storage-${VARIANT} COMMAND kalandra-cpu-storage-tests-${VARIANT})
    set_tests_properties(native-cpu-storage-${VARIANT} PROPERTIES TIMEOUT 60)
  endforeach()
endif()

# Separate typed entry objects preserve the existing float32 CLI ABI.
foreach(VARIANT IN ITEMS debug sanitized thread-sanitized)
  add_library(kalandra-int32-entry-${VARIANT} STATIC runtime/Int32Entry.cpp)
  target_compile_options(kalandra-int32-entry-${VARIANT} PRIVATE -Wall -Wextra -Werror)
  if(VARIANT STREQUAL "sanitized")
    target_compile_options(kalandra-int32-entry-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
  elseif(VARIANT STREQUAL "thread-sanitized")
    target_compile_options(kalandra-int32-entry-${VARIANT} PRIVATE -fsanitize=thread -fno-omit-frame-pointer)
  endif()
endforeach()
target_compile_definitions(kalandrac PRIVATE
  KALANDRA_INT32_ENTRY="$<TARGET_FILE:kalandra-int32-entry-debug>"
  KALANDRA_INT32_SANITIZED_ENTRY="$<TARGET_FILE:kalandra-int32-entry-sanitized>"
  KALANDRA_INT32_THREAD_SANITIZED_ENTRY="$<TARGET_FILE:kalandra-int32-entry-thread-sanitized>")
add_dependencies(kalandrac kalandra-int32-entry-debug kalandra-int32-entry-sanitized kalandra-int32-entry-thread-sanitized)

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug sanitized)
    add_executable(kalandra-int32-tests-${VARIANT} tests/Int32Tests.cpp)
    target_compile_options(kalandra-int32-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_link_libraries(kalandra-int32-tests-${VARIANT} PRIVATE kalandra-semantics-sanitized)
      target_compile_definitions(kalandra-int32-tests-${VARIANT} PRIVATE KALANDRA_INT32_FRONTEND_ONLY)
      target_compile_options(kalandra-int32-tests-${VARIANT} PRIVATE -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-int32-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
    else()
      target_link_libraries(kalandra-int32-tests-${VARIANT} PRIVATE kalandra-backend)
    endif()
    add_test(NAME native-int32-frontend-${VARIANT} COMMAND kalandra-int32-tests-${VARIANT})
    set_tests_properties(native-int32-frontend-${VARIANT} PROPERTIES TIMEOUT 60)
  endforeach()
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(INT32_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-sanitized>")
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(INT32_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
    else()
      set(INT32_RUNTIME "$<TARGET_FILE:kalandra-native-runtime>")
    endif()
    add_test(NAME native-int32-runtime-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=${INT32_RUNTIME}" "-DVARIANT=${VARIANT}"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/int32-${VARIANT}"
        "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/Int32RuntimeTests.cpp"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyInt32.cmake")
    set_tests_properties(native-int32-runtime-${VARIANT} PROPERTIES TIMEOUT 180)
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    add_test(NAME native-int32-tasks-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>" "-DVARIANT=${VARIANT}"
        "-DFIXTURES=${CMAKE_CURRENT_SOURCE_DIR}/tests/fixtures"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/int32-tasks-${VARIANT}"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyInt32Tasks.cmake")
    set_tests_properties(native-int32-tasks-${VARIANT} PROPERTIES TIMEOUT 180)
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(INT32_TENSOR_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-sanitized>")
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(INT32_TENSOR_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
    else()
      set(INT32_TENSOR_RUNTIME "$<TARGET_FILE:kalandra-native-runtime>")
    endif()
    add_test(NAME native-int32-tensors-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=${INT32_TENSOR_RUNTIME}" "-DVARIANT=${VARIANT}"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/int32-tensors-${VARIANT}"
        "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/Int32TensorRuntimeTests.cpp"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyInt32Tensors.cmake")
    set_tests_properties(native-int32-tensors-${VARIANT} PROPERTIES TIMEOUT 240)
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(INT32_HANDOFF_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-sanitized>")
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(INT32_HANDOFF_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
    else()
      set(INT32_HANDOFF_RUNTIME "$<TARGET_FILE:kalandra-native-runtime>")
    endif()
    add_test(NAME native-int32-tensor-tasks-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=${INT32_HANDOFF_RUNTIME}"
        "-DOPT_RUNTIME=$<TARGET_FILE:kalandra-task-core-optimized>" "-DVARIANT=${VARIANT}"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/int32-tensor-tasks-${VARIANT}"
        "-DFIXTURES=${CMAKE_CURRENT_SOURCE_DIR}/tests/fixtures"
        "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/Int32TensorTaskTests.cpp"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyInt32TensorTasks.cmake")
    set_tests_properties(native-int32-tensor-tasks-${VARIANT} PROPERTIES TIMEOUT 240)
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(INT32_REDUCTION_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-sanitized>")
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(INT32_REDUCTION_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
    else()
      set(INT32_REDUCTION_RUNTIME "$<TARGET_FILE:kalandra-native-runtime>")
    endif()
    add_test(NAME native-int32-reductions-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=${INT32_REDUCTION_RUNTIME}"
        "-DVARIANT=${VARIANT}"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/int32-reductions-${VARIANT}"
        "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/Int32ReductionRuntimeTests.cpp"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyInt32Reductions.cmake")
    set_tests_properties(native-int32-reductions-${VARIANT} PROPERTIES TIMEOUT 240)
    add_test(NAME native-uint32-reductions-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=${INT32_REDUCTION_RUNTIME}"
        "-DVARIANT=${VARIANT}" "-DNUMERIC_TYPE=uint32"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/uint32-reductions-${VARIANT}"
        "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/Int32ReductionRuntimeTests.cpp"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyInt32Reductions.cmake")
    set_tests_properties(native-uint32-reductions-${VARIANT} PROPERTIES TIMEOUT 240)
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(INT32_MATMUL_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-sanitized>")
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(INT32_MATMUL_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
    else()
      set(INT32_MATMUL_RUNTIME "$<TARGET_FILE:kalandra-native-runtime>")
    endif()
    add_test(NAME native-int32-matmul-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=${INT32_MATMUL_RUNTIME}"
        "-DVARIANT=${VARIANT}" "-DOPT_RUNTIME=$<TARGET_FILE:kalandra-task-core-optimized>"
        "-DTASK_HARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/Int32TensorTaskTests.cpp"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/int32-matmul-${VARIANT}"
        "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/Int32MatmulRuntimeTests.cpp"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyInt32Matmul.cmake")
    set_tests_properties(native-int32-matmul-${VARIANT} PROPERTIES TIMEOUT 240)
    add_test(NAME native-uint32-matmul-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=${INT32_MATMUL_RUNTIME}"
        "-DVARIANT=${VARIANT}" "-DNUMERIC_TYPE=uint32"
        "-DOPT_RUNTIME=$<TARGET_FILE:kalandra-task-core-optimized>"
        "-DTASK_HARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/Int32TensorTaskTests.cpp"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/uint32-matmul-${VARIANT}"
        "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/Int32MatmulRuntimeTests.cpp"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyInt32Matmul.cmake")
    set_tests_properties(native-uint32-matmul-${VARIANT} PROPERTIES TIMEOUT 240)
  endforeach()
endif()

# Separate typed entry objects preserve the existing float32 CLI ABI.
foreach(VARIANT IN ITEMS debug sanitized thread-sanitized)
  add_library(kalandra-uint32-entry-${VARIANT} STATIC runtime/UInt32Entry.cpp)
  target_compile_options(kalandra-uint32-entry-${VARIANT} PRIVATE -Wall -Wextra -Werror)
  if(VARIANT STREQUAL "sanitized")
    target_compile_options(kalandra-uint32-entry-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
  elseif(VARIANT STREQUAL "thread-sanitized")
    target_compile_options(kalandra-uint32-entry-${VARIANT} PRIVATE -fsanitize=thread -fno-omit-frame-pointer)
  endif()
endforeach()
target_compile_definitions(kalandrac PRIVATE
  KALANDRA_UINT32_ENTRY="$<TARGET_FILE:kalandra-uint32-entry-debug>"
  KALANDRA_UINT32_SANITIZED_ENTRY="$<TARGET_FILE:kalandra-uint32-entry-sanitized>"
  KALANDRA_UINT32_THREAD_SANITIZED_ENTRY="$<TARGET_FILE:kalandra-uint32-entry-thread-sanitized>")
add_dependencies(kalandrac kalandra-uint32-entry-debug kalandra-uint32-entry-sanitized kalandra-uint32-entry-thread-sanitized)

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug sanitized)
    add_executable(kalandra-uint32-tests-${VARIANT} tests/UInt32Tests.cpp)
    target_compile_options(kalandra-uint32-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_link_libraries(kalandra-uint32-tests-${VARIANT} PRIVATE kalandra-semantics-sanitized)
      target_compile_definitions(kalandra-uint32-tests-${VARIANT} PRIVATE KALANDRA_UINT32_FRONTEND_ONLY)
      target_compile_options(kalandra-uint32-tests-${VARIANT} PRIVATE -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-uint32-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
    else()
      target_link_libraries(kalandra-uint32-tests-${VARIANT} PRIVATE kalandra-backend)
    endif()
    add_test(NAME native-uint32-frontend-${VARIANT} COMMAND kalandra-uint32-tests-${VARIANT})
    set_tests_properties(native-uint32-frontend-${VARIANT} PROPERTIES TIMEOUT 60)
  endforeach()
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(UINT32_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-sanitized>")
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(UINT32_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
    else()
      set(UINT32_RUNTIME "$<TARGET_FILE:kalandra-native-runtime>")
    endif()
    add_test(NAME native-uint32-runtime-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=${UINT32_RUNTIME}" "-DVARIANT=${VARIANT}"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/uint32-${VARIANT}"
        "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/UInt32RuntimeTests.cpp"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyUInt32.cmake")
    set_tests_properties(native-uint32-runtime-${VARIANT} PROPERTIES TIMEOUT 180)
  endforeach()
endif()
if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(UINT32_TENSOR_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-sanitized>")
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(UINT32_TENSOR_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
    else()
      set(UINT32_TENSOR_RUNTIME "$<TARGET_FILE:kalandra-native-runtime>")
    endif()
    add_test(NAME native-uint32-tensors-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=${UINT32_TENSOR_RUNTIME}" "-DVARIANT=${VARIANT}"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/uint32-tensors-${VARIANT}"
        "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/UInt32TensorRuntimeTests.cpp"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyUInt32Tensors.cmake")
    set_tests_properties(native-uint32-tensors-${VARIANT} PROPERTIES TIMEOUT 240)
  endforeach()
endif()
if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(UINT32_HANDOFF_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-sanitized>")
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(UINT32_HANDOFF_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
    else()
      set(UINT32_HANDOFF_RUNTIME "$<TARGET_FILE:kalandra-native-runtime>")
    endif()
    add_test(NAME native-uint32-tensor-tasks-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=${UINT32_HANDOFF_RUNTIME}"
        "-DOPT_RUNTIME=$<TARGET_FILE:kalandra-task-core-optimized>" "-DVARIANT=${VARIANT}"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/uint32-tensor-tasks-${VARIANT}"
        "-DFIXTURES=${CMAKE_CURRENT_SOURCE_DIR}/tests/fixtures"
        "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/Int32TensorTaskTests.cpp"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyUInt32TensorTasks.cmake")
    set_tests_properties(native-uint32-tensor-tasks-${VARIANT} PROPERTIES TIMEOUT 240)
  endforeach()
endif()
# Separate typed entry objects preserve the existing float32 CLI ABI.
foreach(VARIANT IN ITEMS debug sanitized thread-sanitized)
  add_library(kalandra-int64-entry-${VARIANT} STATIC runtime/Int64Entry.cpp)
  target_compile_options(kalandra-int64-entry-${VARIANT} PRIVATE -Wall -Wextra -Werror)
  if(VARIANT STREQUAL "sanitized")
    target_compile_options(kalandra-int64-entry-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
  elseif(VARIANT STREQUAL "thread-sanitized")
    target_compile_options(kalandra-int64-entry-${VARIANT} PRIVATE -fsanitize=thread -fno-omit-frame-pointer)
  endif()
endforeach()
target_compile_definitions(kalandrac PRIVATE
  KALANDRA_INT64_ENTRY="$<TARGET_FILE:kalandra-int64-entry-debug>"
  KALANDRA_INT64_SANITIZED_ENTRY="$<TARGET_FILE:kalandra-int64-entry-sanitized>"
  KALANDRA_INT64_THREAD_SANITIZED_ENTRY="$<TARGET_FILE:kalandra-int64-entry-thread-sanitized>")
add_dependencies(kalandrac kalandra-int64-entry-debug kalandra-int64-entry-sanitized kalandra-int64-entry-thread-sanitized)


if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug sanitized)
    add_executable(kalandra-int64-tests-${VARIANT} tests/Int64Tests.cpp)
    target_compile_options(kalandra-int64-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_link_libraries(kalandra-int64-tests-${VARIANT} PRIVATE kalandra-semantics-sanitized)
      target_compile_definitions(kalandra-int64-tests-${VARIANT} PRIVATE KALANDRA_INT64_FRONTEND_ONLY)
      target_compile_options(kalandra-int64-tests-${VARIANT} PRIVATE -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-int64-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
    else()
      target_link_libraries(kalandra-int64-tests-${VARIANT} PRIVATE kalandra-backend)
    endif()
    add_test(NAME native-int64-frontend-${VARIANT} COMMAND kalandra-int64-tests-${VARIANT})
    set_tests_properties(native-int64-frontend-${VARIANT} PROPERTIES TIMEOUT 60)
  endforeach()
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(INT64_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-sanitized>")
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(INT64_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
    else()
      set(INT64_RUNTIME "$<TARGET_FILE:kalandra-native-runtime>")
    endif()
    add_test(NAME native-int64-runtime-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=${INT64_RUNTIME}" "-DVARIANT=${VARIANT}" "-DNUMERIC_TYPE=int64"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/int64-${VARIANT}"
        "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/Int32RuntimeTests.cpp"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyInt32.cmake")
    set_tests_properties(native-int64-runtime-${VARIANT} PROPERTIES TIMEOUT 180)
  endforeach()
endif()


if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    add_test(NAME native-int64-tasks-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>" "-DVARIANT=${VARIANT}" "-DNUMERIC_TYPE=int64"
        "-DFIXTURES=${CMAKE_CURRENT_SOURCE_DIR}/tests/fixtures"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/int64-tasks-${VARIANT}"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyInt32Tasks.cmake")
    set_tests_properties(native-int64-tasks-${VARIANT} PROPERTIES TIMEOUT 180)
  endforeach()
endif()

# Separate typed entry objects preserve the existing float32 CLI ABI.
foreach(VARIANT IN ITEMS debug sanitized thread-sanitized)
  add_library(kalandra-uint64-entry-${VARIANT} STATIC runtime/UInt64Entry.cpp)
  target_compile_options(kalandra-uint64-entry-${VARIANT} PRIVATE -Wall -Wextra -Werror)
  if(VARIANT STREQUAL "sanitized")
    target_compile_options(kalandra-uint64-entry-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
  elseif(VARIANT STREQUAL "thread-sanitized")
    target_compile_options(kalandra-uint64-entry-${VARIANT} PRIVATE -fsanitize=thread -fno-omit-frame-pointer)
  endif()
endforeach()
target_compile_definitions(kalandrac PRIVATE
  KALANDRA_UINT64_ENTRY="$<TARGET_FILE:kalandra-uint64-entry-debug>"
  KALANDRA_UINT64_SANITIZED_ENTRY="$<TARGET_FILE:kalandra-uint64-entry-sanitized>"
  KALANDRA_UINT64_THREAD_SANITIZED_ENTRY="$<TARGET_FILE:kalandra-uint64-entry-thread-sanitized>")
add_dependencies(kalandrac kalandra-uint64-entry-debug kalandra-uint64-entry-sanitized kalandra-uint64-entry-thread-sanitized)

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug sanitized)
    add_executable(kalandra-uint64-tests-${VARIANT} tests/UInt64Tests.cpp)
    target_compile_options(kalandra-uint64-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_link_libraries(kalandra-uint64-tests-${VARIANT} PRIVATE kalandra-semantics-sanitized)
      target_compile_definitions(kalandra-uint64-tests-${VARIANT} PRIVATE KALANDRA_UINT64_FRONTEND_ONLY)
      target_compile_options(kalandra-uint64-tests-${VARIANT} PRIVATE -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-uint64-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
    else()
      target_link_libraries(kalandra-uint64-tests-${VARIANT} PRIVATE kalandra-backend)
    endif()
    add_test(NAME native-uint64-frontend-${VARIANT} COMMAND kalandra-uint64-tests-${VARIANT})
    set_tests_properties(native-uint64-frontend-${VARIANT} PROPERTIES TIMEOUT 60)
  endforeach()
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(UINT64_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-sanitized>")
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(UINT64_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
    else()
      set(UINT64_RUNTIME "$<TARGET_FILE:kalandra-native-runtime>")
    endif()
    add_test(NAME native-uint64-runtime-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=${UINT64_RUNTIME}" "-DVARIANT=${VARIANT}" "-DNUMERIC_TYPE=uint64"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/uint64-${VARIANT}"
        "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/UInt32RuntimeTests.cpp"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyUInt32.cmake")
    set_tests_properties(native-uint64-runtime-${VARIANT} PROPERTIES TIMEOUT 180)
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(NUMERIC_TYPE IN ITEMS int64 uint64)
    foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
      if(VARIANT STREQUAL "sanitized")
        set(INTEGER64_TENSOR_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-sanitized>")
      elseif(VARIANT STREQUAL "thread-sanitized")
        set(INTEGER64_TENSOR_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
      else()
        set(INTEGER64_TENSOR_RUNTIME "$<TARGET_FILE:kalandra-native-runtime>")
      endif()
      add_test(NAME native-${NUMERIC_TYPE}-tensors-${VARIANT}
        COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
          "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=${INTEGER64_TENSOR_RUNTIME}"
          "-DVARIANT=${VARIANT}" "-DNUMERIC_TYPE=${NUMERIC_TYPE}"
          "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/${NUMERIC_TYPE}-tensors-${VARIANT}"
          "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/Integer64TensorRuntimeTests.cpp"
          -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyInteger64Tensors.cmake")
      set_tests_properties(native-${NUMERIC_TYPE}-tensors-${VARIANT} PROPERTIES TIMEOUT 240)
    endforeach()
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(NUMERIC_TYPE IN ITEMS int64 uint64)
    foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
      if(VARIANT STREQUAL "sanitized")
        set(INTEGER64_HANDOFF_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-sanitized>")
      elseif(VARIANT STREQUAL "thread-sanitized")
        set(INTEGER64_HANDOFF_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
      else()
        set(INTEGER64_HANDOFF_RUNTIME "$<TARGET_FILE:kalandra-native-runtime>")
      endif()
      add_test(NAME native-${NUMERIC_TYPE}-tensor-tasks-${VARIANT}
        COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
          "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=${INTEGER64_HANDOFF_RUNTIME}"
          "-DOPT_RUNTIME=$<TARGET_FILE:kalandra-task-core-optimized>"
          "-DVARIANT=${VARIANT}" "-DNUMERIC_TYPE=${NUMERIC_TYPE}"
          "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/${NUMERIC_TYPE}-tensor-tasks-${VARIANT}"
          "-DFIXTURES=${CMAKE_CURRENT_SOURCE_DIR}/tests/fixtures"
          "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/Int32TensorTaskTests.cpp"
          -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyInteger64TensorTasks.cmake")
      set_tests_properties(native-${NUMERIC_TYPE}-tensor-tasks-${VARIANT} PROPERTIES TIMEOUT 240)
    endforeach()
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(NUMERIC_TYPE IN ITEMS int64 uint64)
    foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
      if(VARIANT STREQUAL "sanitized")
        set(INTEGER64_REDUCTION_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-sanitized>")
      elseif(VARIANT STREQUAL "thread-sanitized")
        set(INTEGER64_REDUCTION_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
      else()
        set(INTEGER64_REDUCTION_RUNTIME "$<TARGET_FILE:kalandra-native-runtime>")
      endif()
      add_test(NAME native-${NUMERIC_TYPE}-reductions-${VARIANT}
        COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
          "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=${INTEGER64_REDUCTION_RUNTIME}"
          "-DVARIANT=${VARIANT}" "-DNUMERIC_TYPE=${NUMERIC_TYPE}"
          "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/${NUMERIC_TYPE}-reductions-${VARIANT}"
          "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/Int32ReductionRuntimeTests.cpp"
          -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyInt32Reductions.cmake")
      set_tests_properties(native-${NUMERIC_TYPE}-reductions-${VARIANT} PROPERTIES TIMEOUT 240)
    endforeach()
  endforeach()
endif()

if(BUILD_TESTING)
  foreach(NUMERIC_TYPE IN ITEMS int64 uint64)
    foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
      if(VARIANT STREQUAL "sanitized")
        set(INTEGER64_MATMUL_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-sanitized>")
      elseif(VARIANT STREQUAL "thread-sanitized")
        set(INTEGER64_MATMUL_RUNTIME "$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
      else()
        set(INTEGER64_MATMUL_RUNTIME "$<TARGET_FILE:kalandra-native-runtime>")
      endif()
      add_test(NAME native-${NUMERIC_TYPE}-matmul-${VARIANT}
        COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
          "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=${INTEGER64_MATMUL_RUNTIME}"
          "-DOPT_RUNTIME=$<TARGET_FILE:kalandra-task-core-optimized>"
          "-DVARIANT=${VARIANT}" "-DNUMERIC_TYPE=${NUMERIC_TYPE}"
          "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/${NUMERIC_TYPE}-matmul-${VARIANT}"
          "-DHARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/Int32MatmulRuntimeTests.cpp"
          "-DTASK_HARNESS_SOURCE=${CMAKE_CURRENT_SOURCE_DIR}/tests/Int32TensorTaskTests.cpp"
          -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyInt32Matmul.cmake")
      set_tests_properties(native-${NUMERIC_TYPE}-matmul-${VARIANT} PROPERTIES TIMEOUT 240)
    endforeach()
  endforeach()
endif()

# Separate typed entry objects preserve the existing float32 CLI ABI.
foreach(VARIANT IN ITEMS debug sanitized thread-sanitized)
  add_library(kalandra-float64-entry-${VARIANT} STATIC runtime/Float64Entry.cpp)
  target_compile_options(kalandra-float64-entry-${VARIANT} PRIVATE -Wall -Wextra -Werror)
  if(VARIANT STREQUAL "sanitized")
    target_compile_options(kalandra-float64-entry-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
  elseif(VARIANT STREQUAL "thread-sanitized")
    target_compile_options(kalandra-float64-entry-${VARIANT} PRIVATE -fsanitize=thread -fno-omit-frame-pointer)
  endif()
endforeach()
target_compile_definitions(kalandrac PRIVATE
  KALANDRA_FLOAT64_ENTRY="$<TARGET_FILE:kalandra-float64-entry-debug>"
  KALANDRA_FLOAT64_SANITIZED_ENTRY="$<TARGET_FILE:kalandra-float64-entry-sanitized>"
  KALANDRA_FLOAT64_THREAD_SANITIZED_ENTRY="$<TARGET_FILE:kalandra-float64-entry-thread-sanitized>")
add_dependencies(kalandrac kalandra-float64-entry-debug kalandra-float64-entry-sanitized kalandra-float64-entry-thread-sanitized)

if(BUILD_TESTING)
  include(cmake/Float64.cmake)
  include(cmake/Conversions.cmake)
endif()

include(cmake/Booleans.cmake)

include(cmake/ControlFlow.cmake)

include(cmake/TensorInference.cmake)

include(cmake/Arrays.cmake)

include(cmake/ArrayMap.cmake)

include(cmake/ArrayTensor.cmake)

include(cmake/Reshape.cmake)

include(cmake/ArrayIndex.cmake)

include(cmake/TensorIndex.cmake)

include(cmake/CollectionQuery.cmake)

include(cmake/TensorReshape.cmake)

include(cmake/TensorArray.cmake)

include(cmake/Modules.cmake)
