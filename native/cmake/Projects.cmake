if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug sanitized)
    add_executable(kalandra-project-tests-${VARIANT} tests/ProjectTests.cpp)
    target_compile_options(kalandra-project-tests-${VARIANT} PRIVATE -Wall -Wextra -Werror)
    if(VARIANT STREQUAL "sanitized")
      target_link_libraries(kalandra-project-tests-${VARIANT} PRIVATE kalandra-semantics-sanitized kalandra-project-sanitized)
      target_compile_definitions(kalandra-project-tests-${VARIANT} PRIVATE KALANDRA_PROJECT_FRONTEND_ONLY)
      target_compile_options(kalandra-project-tests-${VARIANT} PRIVATE -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      target_link_options(kalandra-project-tests-${VARIANT} PRIVATE -fsanitize=address,undefined -fno-sanitize-recover=all)
    else()
      target_link_libraries(kalandra-project-tests-${VARIANT} PRIVATE kalandra-backend kalandra-project)
    endif()
    add_test(NAME native-projects-frontend-${VARIANT} COMMAND kalandra-project-tests-${VARIANT} "${CMAKE_CURRENT_BINARY_DIR}/projects-frontend-${VARIANT}")
    set_tests_properties(native-projects-frontend-${VARIANT} PROPERTIES TIMEOUT 90)
  endforeach()
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    if(VARIANT STREQUAL "sanitized")
      set(PROJECT_RUNTIME kalandra-native-runtime-sanitized)
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(PROJECT_RUNTIME kalandra-native-runtime-thread-sanitized)
    else()
      set(PROJECT_RUNTIME kalandra-native-runtime)
    endif()
    add_test(NAME native-projects-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>" "-DCHECKER=$<TARGET_FILE:kalandra-check>" "-DVARIANT=${VARIANT}"
        "-DCLANGXX=${CMAKE_CXX_COMPILER}" "-DRUNTIME=$<TARGET_FILE:${PROJECT_RUNTIME}>"
        "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/projects-${VARIANT}"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyProjects.cmake")
    set_tests_properties(native-projects-${VARIANT} PROPERTIES TIMEOUT 300)
    add_test(NAME native-project-cli-${VARIANT}
      COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>" "-DCHECKER=$<TARGET_FILE:kalandra-check>" "-DVARIANT=${VARIANT}"
        "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/project-cli-${VARIANT}"
        -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/VerifyProjectCLI.cmake")
    set_tests_properties(native-project-cli-${VARIANT} PROPERTIES TIMEOUT 90)
  endforeach()
endif()
