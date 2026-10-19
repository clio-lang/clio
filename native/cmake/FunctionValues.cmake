if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug sanitized)
    add_executable(kalandra-function-value-tests-${VARIANT} tests/FunctionValueTests.cpp)
    target_compile_options(kalandra-function-value-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_link_libraries(kalandra-function-value-tests-${VARIANT} PRIVATE kalandra-semantics-sanitized)
      target_compile_definitions(kalandra-function-value-tests-${VARIANT} PRIVATE KALANDRA_FUNCTION_FRONTEND_ONLY)
      target_compile_options(kalandra-function-value-tests-${VARIANT} PRIVATE -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-function-value-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
    else()
      target_link_libraries(kalandra-function-value-tests-${VARIANT} PRIVATE kalandra-backend)
    endif()
    add_test(NAME native-function-values-frontend-${VARIANT} COMMAND kalandra-function-value-tests-${VARIANT})
    set_tests_properties(native-function-values-frontend-${VARIANT} PROPERTIES TIMEOUT 120)
  endforeach()
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(FUNCTION_RUNTIME kalandra-native-runtime-sanitized)
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(FUNCTION_RUNTIME kalandra-native-runtime-thread-sanitized)
    else()
      set(FUNCTION_RUNTIME kalandra-native-runtime)
    endif()
    add_test(NAME native-function-values-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}"
        "-DLLVM_ROOT=${KALANDRA_LLVM_ROOT}"
        "-DRUNTIME=$<TARGET_FILE:${FUNCTION_RUNTIME}>"
        "-DVARIANT=${VARIANT}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/function-values-${VARIANT}"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyFunctionValues.cmake")
    set_tests_properties(native-function-values-${VARIANT} PROPERTIES TIMEOUT 240)
    add_test(NAME native-function-collections-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}"
        "-DLLVM_ROOT=${KALANDRA_LLVM_ROOT}"
        "-DRUNTIME=$<TARGET_FILE:${FUNCTION_RUNTIME}>"
        "-DVARIANT=${VARIANT}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/function-collections-${VARIANT}"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyFunctionCollections.cmake")
    set_tests_properties(native-function-collections-${VARIANT} PROPERTIES TIMEOUT 300)
  endforeach()
endif()
