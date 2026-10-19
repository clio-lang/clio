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
    add_executable(kalandra-fallible-function-tests-${VARIANT} tests/FallibleFunctionTests.cpp)
    target_compile_options(kalandra-fallible-function-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_link_libraries(kalandra-fallible-function-tests-${VARIANT} PRIVATE kalandra-semantics-sanitized)
      target_compile_definitions(kalandra-fallible-function-tests-${VARIANT} PRIVATE KALANDRA_FUNCTION_FRONTEND_ONLY)
      target_compile_options(kalandra-fallible-function-tests-${VARIANT} PRIVATE -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-fallible-function-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
    else()
      target_link_libraries(kalandra-fallible-function-tests-${VARIANT} PRIVATE kalandra-backend)
    endif()
    add_test(NAME native-fallible-functions-frontend-${VARIANT} COMMAND kalandra-fallible-function-tests-${VARIANT})
    set_tests_properties(native-fallible-functions-frontend-${VARIANT} PROPERTIES TIMEOUT 120)
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
    add_test(NAME native-fallible-functions-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}"
        "-DLLVM_ROOT=${KALANDRA_LLVM_ROOT}" "-DRUNTIME=$<TARGET_FILE:${FUNCTION_RUNTIME}>"
        "-DVARIANT=${VARIANT}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/fallible-functions-${VARIANT}"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyFallibleFunctions.cmake")
    set_tests_properties(native-fallible-functions-${VARIANT} PROPERTIES TIMEOUT 300)
  endforeach()
  foreach(VARIANT IN ITEMS debug sanitized)
    add_executable(kalandra-closure-tests-${VARIANT} tests/ClosureTests.cpp)
    target_compile_options(kalandra-closure-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_link_libraries(kalandra-closure-tests-${VARIANT} PRIVATE kalandra-semantics-sanitized)
      target_compile_definitions(kalandra-closure-tests-${VARIANT} PRIVATE KALANDRA_FUNCTION_FRONTEND_ONLY)
      target_compile_options(kalandra-closure-tests-${VARIANT} PRIVATE -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-closure-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
    else()
      target_link_libraries(kalandra-closure-tests-${VARIANT} PRIVATE kalandra-backend)
    endif()
    add_test(NAME native-closures-frontend-${VARIANT} COMMAND kalandra-closure-tests-${VARIANT})
    set_tests_properties(native-closures-frontend-${VARIANT} PROPERTIES TIMEOUT 120)
  endforeach()
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(CLOSURE_RUNTIME kalandra-native-runtime-sanitized)
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(CLOSURE_RUNTIME kalandra-native-runtime-thread-sanitized)
    else()
      set(CLOSURE_RUNTIME kalandra-native-runtime)
    endif()
    add_test(NAME native-closures-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}"
        "-DLLVM_ROOT=${KALANDRA_LLVM_ROOT}" "-DRUNTIME=$<TARGET_FILE:${CLOSURE_RUNTIME}>"
        "-DVARIANT=${VARIANT}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/closures-${VARIANT}"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyClosures.cmake")
    set_tests_properties(native-closures-${VARIANT} PROPERTIES TIMEOUT 300)
  endforeach()

  foreach(VARIANT IN ITEMS debug sanitized)
    add_executable(kalandra-block-closure-tests-${VARIANT} tests/BlockClosureTests.cpp)
    target_compile_options(kalandra-block-closure-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_link_libraries(kalandra-block-closure-tests-${VARIANT} PRIVATE kalandra-semantics-sanitized)
      target_compile_definitions(kalandra-block-closure-tests-${VARIANT} PRIVATE KALANDRA_FUNCTION_FRONTEND_ONLY)
      target_compile_options(kalandra-block-closure-tests-${VARIANT} PRIVATE -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-block-closure-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
    else()
      target_link_libraries(kalandra-block-closure-tests-${VARIANT} PRIVATE kalandra-backend)
    endif()
    add_test(NAME native-block-closures-frontend-${VARIANT} COMMAND kalandra-block-closure-tests-${VARIANT})
    set_tests_properties(native-block-closures-frontend-${VARIANT} PROPERTIES TIMEOUT 120)
  endforeach()
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(BLOCK_CLOSURE_RUNTIME kalandra-native-runtime-sanitized)
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(BLOCK_CLOSURE_RUNTIME kalandra-native-runtime-thread-sanitized)
    else()
      set(BLOCK_CLOSURE_RUNTIME kalandra-native-runtime)
    endif()
    add_test(NAME native-block-closures-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}"
        "-DLLVM_ROOT=${KALANDRA_LLVM_ROOT}" "-DRUNTIME=$<TARGET_FILE:${BLOCK_CLOSURE_RUNTIME}>"
        "-DVARIANT=${VARIANT}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/block-closures-${VARIANT}"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyBlockClosures.cmake")
    set_tests_properties(native-block-closures-${VARIANT} PROPERTIES TIMEOUT 300)
  endforeach()

  foreach(VARIANT IN ITEMS debug sanitized)
    add_executable(kalandra-anonymous-error-tests-${VARIANT} tests/AnonymousErrorTests.cpp)
    target_compile_options(kalandra-anonymous-error-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_link_libraries(kalandra-anonymous-error-tests-${VARIANT} PRIVATE kalandra-semantics-sanitized)
      target_compile_definitions(kalandra-anonymous-error-tests-${VARIANT} PRIVATE KALANDRA_FUNCTION_FRONTEND_ONLY)
      target_compile_options(kalandra-anonymous-error-tests-${VARIANT} PRIVATE -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-anonymous-error-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
    else()
      target_link_libraries(kalandra-anonymous-error-tests-${VARIANT} PRIVATE kalandra-backend)
    endif()
    add_test(NAME native-anonymous-errors-frontend-${VARIANT} COMMAND kalandra-anonymous-error-tests-${VARIANT})
    set_tests_properties(native-anonymous-errors-frontend-${VARIANT} PROPERTIES TIMEOUT 120)
  endforeach()
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(ANONYMOUS_ERROR_RUNTIME kalandra-native-runtime-sanitized)
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(ANONYMOUS_ERROR_RUNTIME kalandra-native-runtime-thread-sanitized)
    else()
      set(ANONYMOUS_ERROR_RUNTIME kalandra-native-runtime)
    endif()
    add_test(NAME native-anonymous-errors-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}"
        "-DLLVM_ROOT=${KALANDRA_LLVM_ROOT}" "-DRUNTIME=$<TARGET_FILE:${ANONYMOUS_ERROR_RUNTIME}>"
        "-DVARIANT=${VARIANT}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/anonymous-errors-${VARIANT}"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyAnonymousErrors.cmake")
    set_tests_properties(native-anonymous-errors-${VARIANT} PROPERTIES TIMEOUT 300)
  endforeach()

  foreach(VARIANT IN ITEMS debug sanitized)
    add_executable(kalandra-callable-field-tests-${VARIANT} tests/CallableFieldTests.cpp)
    target_compile_options(kalandra-callable-field-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_link_libraries(kalandra-callable-field-tests-${VARIANT} PRIVATE kalandra-semantics-sanitized)
      target_compile_definitions(kalandra-callable-field-tests-${VARIANT} PRIVATE KALANDRA_FUNCTION_FRONTEND_ONLY)
      target_compile_options(kalandra-callable-field-tests-${VARIANT} PRIVATE -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-callable-field-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
    else()
      target_link_libraries(kalandra-callable-field-tests-${VARIANT} PRIVATE kalandra-backend)
    endif()
    add_test(NAME native-callable-fields-frontend-${VARIANT} COMMAND kalandra-callable-field-tests-${VARIANT})
    set_tests_properties(native-callable-fields-frontend-${VARIANT} PROPERTIES TIMEOUT 120)
  endforeach()
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(CALLABLE_FIELD_RUNTIME kalandra-native-runtime-sanitized)
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(CALLABLE_FIELD_RUNTIME kalandra-native-runtime-thread-sanitized)
    else()
      set(CALLABLE_FIELD_RUNTIME kalandra-native-runtime)
    endif()
    add_test(NAME native-callable-fields-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}"
        "-DLLVM_ROOT=${KALANDRA_LLVM_ROOT}" "-DRUNTIME=$<TARGET_FILE:${CALLABLE_FIELD_RUNTIME}>"
        "-DVARIANT=${VARIANT}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/callable-fields-${VARIANT}"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyCallableFields.cmake")
    set_tests_properties(native-callable-fields-${VARIANT} PROPERTIES TIMEOUT 300)
  endforeach()

  foreach(VARIANT IN ITEMS debug sanitized)
    add_executable(kalandra-function-array-tests-${VARIANT} tests/FunctionArrayTests.cpp)
    target_compile_options(kalandra-function-array-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_link_libraries(kalandra-function-array-tests-${VARIANT} PRIVATE kalandra-semantics-sanitized)
      target_compile_definitions(kalandra-function-array-tests-${VARIANT} PRIVATE KALANDRA_FUNCTION_FRONTEND_ONLY)
      target_compile_options(kalandra-function-array-tests-${VARIANT} PRIVATE -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-function-array-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
    else()
      target_link_libraries(kalandra-function-array-tests-${VARIANT} PRIVATE kalandra-backend)
    endif()
    add_test(NAME native-function-arrays-frontend-${VARIANT} COMMAND kalandra-function-array-tests-${VARIANT})
    set_tests_properties(native-function-arrays-frontend-${VARIANT} PROPERTIES TIMEOUT 120)
  endforeach()
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(FUNCTION_ARRAY_RUNTIME kalandra-native-runtime-sanitized)
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(FUNCTION_ARRAY_RUNTIME kalandra-native-runtime-thread-sanitized)
    else()
      set(FUNCTION_ARRAY_RUNTIME kalandra-native-runtime)
    endif()
    add_test(NAME native-function-arrays-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}"
        "-DLLVM_ROOT=${KALANDRA_LLVM_ROOT}" "-DRUNTIME=$<TARGET_FILE:${FUNCTION_ARRAY_RUNTIME}>"
        "-DVARIANT=${VARIANT}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/function-arrays-${VARIANT}"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyFunctionArrays.cmake")
    set_tests_properties(native-function-arrays-${VARIANT} PROPERTIES TIMEOUT 300)
  endforeach()

endif()
