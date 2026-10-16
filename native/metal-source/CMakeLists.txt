add_library(kalandra-metal-source-backend STATIC Compiler.cpp Build.cpp)
target_link_libraries(kalandra-metal-source-backend PUBLIC kalandra-semantics PRIVATE kalandra-backend MLIR LLVM)
target_include_directories(kalandra-metal-source-backend SYSTEM PRIVATE ${MLIR_INCLUDE_DIRS} ${LLVM_INCLUDE_DIRS})
target_compile_options(kalandra-metal-source-backend PRIVATE -Wall -Wextra -Werror)
add_executable(kalandra-metal-source main.cpp)
target_link_libraries(kalandra-metal-source PRIVATE kalandra-metal-source-backend)
target_compile_options(kalandra-metal-source PRIVATE -Wall -Wextra -Werror)
target_link_libraries(kalandrac PRIVATE kalandra-metal-source-backend)
target_compile_definitions(kalandrac PRIVATE KALANDRA_HAS_METAL_SOURCE=1)
function(add_source_fixture FIXTURE)
set(GENERATED "${CMAKE_CURRENT_BINARY_DIR}/${FIXTURE}")
add_custom_command(OUTPUT "${GENERATED}/host.cpp" "${GENERATED}/placement.ir" "${GENERATED}/continuation.plan" "${GENERATED}/kernel0.mlir" "${GENERATED}/manifest.txt"
  COMMAND $<TARGET_FILE:kalandra-metal-source> "${CMAKE_CURRENT_SOURCE_DIR}/${FIXTURE}.kalandra" -o "${GENERATED}"
  DEPENDS kalandra-metal-source "${FIXTURE}.kalandra" VERBATIM)
# Use the same pinned toolchain and strict integer lowering as the numerical proof.
file(READ "${PROJECT_SOURCE_DIR}/native/metal-proof/toolchain.json" SOURCE_LOCK)
foreach(KEY IN ITEMS spirvCrossRoot spirvToolsRoot metalToolchain strictMetalLanguageVersion strictMslVersion)
  string(JSON SOURCE_${KEY} GET "${SOURCE_LOCK}" "${KEY}")
endforeach()
set(BASE "${GENERATED}/kernel0")
add_custom_command(OUTPUT "${BASE}.metallib" "${BASE}.lowered.mlir" "${BASE}.spvasm" "${BASE}.metal" "${BASE}.reflection.json"
  COMMAND $<TARGET_FILE:kalandra-metal-strict> "${BASE}.mlir" "${BASE}.lowered.mlir"
  COMMAND "${KALANDRA_LLVM_ROOT}/bin/mlir-opt" "${BASE}.lowered.mlir" --verify-each
    "--pass-pipeline=builtin.module(canonicalize,cse,convert-gpu-to-spirv,spirv.module(spirv-lower-abi-attrs,spirv-update-vce))" -o "${BASE}.converted.mlir"
  COMMAND $<TARGET_FILE:kalandra-metal-extract> "${BASE}.converted.mlir" "${BASE}.kernel.mlir" --metal-compiler-rounding
  COMMAND "${KALANDRA_LLVM_ROOT}/bin/mlir-translate" --no-implicit-module --serialize-spirv "${BASE}.kernel.mlir" -o "${BASE}.spv"
  COMMAND "${SOURCE_spirvToolsRoot}/bin/spirv-val" --target-env vulkan1.0 "${BASE}.spv"
  COMMAND "${SOURCE_spirvToolsRoot}/bin/spirv-dis" "${BASE}.spv" -o "${BASE}.spvasm"
  COMMAND "${SOURCE_spirvCrossRoot}/bin/spirv-cross" "${BASE}.spv" --reflect --output "${BASE}.reflection.json"
  COMMAND "${SOURCE_spirvCrossRoot}/bin/spirv-cross" "${BASE}.spv" --msl --msl-version "${SOURCE_strictMslVersion}" --output "${BASE}.metal"
  COMMAND xcrun --toolchain "${SOURCE_metalToolchain}" --sdk macosx metal "-std=${SOURCE_strictMetalLanguageVersion}" -fno-fast-math -ffp-contract=off
    "-fmodules-cache-path=${CMAKE_CURRENT_BINARY_DIR}/module-cache" -c "${BASE}.metal" -o "${BASE}.air"
  COMMAND xcrun --toolchain "${SOURCE_metalToolchain}" metal "${BASE}.air" -o "${BASE}.metallib"
  DEPENDS "${BASE}.mlir" kalandra-metal-strict kalandra-metal-extract "${PROJECT_SOURCE_DIR}/native/metal-proof/toolchain.json"
  BYPRODUCTS "${BASE}.converted.mlir" "${BASE}.kernel.mlir" "${BASE}.spv" "${BASE}.air" VERBATIM)
add_custom_target(native-metal-source-shader-${FIXTURE} ALL DEPENDS "${BASE}.metallib")
if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    add_executable(kalandra-metal-source-${FIXTURE}-${VARIANT} SourceTests.cpp)
    if(VARIANT STREQUAL "sanitized")
      set(FLAGS -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(FLAGS -O1 -g -fsanitize=thread -fno-omit-frame-pointer)
    elseif(VARIANT STREQUAL "optimized")
      set(FLAGS -O2)
    else()
      set(FLAGS -O0)
    endif()
    target_include_directories(kalandra-metal-source-${FIXTURE}-${VARIANT} PRIVATE ../metal "${GENERATED}")
    target_compile_options(kalandra-metal-source-${FIXTURE}-${VARIANT} PRIVATE -Wall -Wextra -Werror ${FLAGS})
    target_link_options(kalandra-metal-source-${FIXTURE}-${VARIANT} PRIVATE ${FLAGS})
    target_link_libraries(kalandra-metal-source-${FIXTURE}-${VARIANT} PRIVATE kalandra-metal-${VARIANT} LLVM)
    target_include_directories(kalandra-metal-source-${FIXTURE}-${VARIANT} SYSTEM PRIVATE ${LLVM_INCLUDE_DIRS})
    if(FIXTURE STREQUAL "composed")
      target_compile_definitions(kalandra-metal-source-${FIXTURE}-${VARIANT} PRIVATE KALANDRA_SOURCE_COMPOSED)
    endif()
    add_dependencies(kalandra-metal-source-${FIXTURE}-${VARIANT} native-metal-source-shader-${FIXTURE})
    add_test(NAME native-metal-source-${FIXTURE}-${VARIANT} COMMAND kalandra-metal-source-${FIXTURE}-${VARIANT} "${GENERATED}")
    set_tests_properties(native-metal-source-${FIXTURE}-${VARIANT} PROPERTIES TIMEOUT 90 RESOURCE_LOCK apple-metal-gpu
      ENVIRONMENT "MTL_DEBUG_LAYER=1" )
  endforeach()
endif()

endfunction()
add_source_fixture(placed)
add_source_fixture(composed)
if(BUILD_TESTING)
  add_executable(kalandra-metal-source-compiler-sanitized main.cpp Compiler.cpp Build.cpp)
  target_link_libraries(kalandra-metal-source-compiler-sanitized PRIVATE kalandra-semantics-sanitized kalandra-backend MLIR LLVM)
  target_include_directories(kalandra-metal-source-compiler-sanitized SYSTEM PRIVATE ${MLIR_INCLUDE_DIRS} ${LLVM_INCLUDE_DIRS})
  target_compile_options(kalandra-metal-source-compiler-sanitized PRIVATE -Wall -Wextra -Werror -O1 -g
    -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
  target_link_options(kalandra-metal-source-compiler-sanitized PRIVATE -fsanitize=address,undefined)
  foreach(COMPILER_TARGET IN ITEMS kalandra-metal-source kalandra-metal-source-compiler-sanitized)
    add_test(NAME ${COMPILER_TARGET}-diagnostics COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:${COMPILER_TARGET}>"
      "-DCPU_CHECKER=$<TARGET_FILE:kalandra-check>" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/${COMPILER_TARGET}-checks"
      "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyRejected.cmake")
    set_tests_properties(${COMPILER_TARGET}-diagnostics PROPERTIES TIMEOUT 90)
  endforeach()
endif()
if(BUILD_TESTING)
  add_test(NAME native-metal-source-artifacts COMMAND "${CMAKE_COMMAND}"
    "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}" -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyArtifacts.cmake")
endif()

set(TOOLCHAIN_HEADER "#pragma once\n")
foreach(PAIR IN ITEMS
    "CLANG|${CMAKE_CXX_COMPILER}" "OPT|${KALANDRA_LLVM_ROOT}/bin/mlir-opt"
    "TRANSLATE|${KALANDRA_LLVM_ROOT}/bin/mlir-translate"
    "STRICT|$<TARGET_FILE:kalandra-metal-strict>" "EXTRACT|$<TARGET_FILE:kalandra-metal-extract>"
    "CROSS|${KALANDRA_SPIRV_CROSS_ROOT}/bin/spirv-cross" "VALIDATE|${KALANDRA_SPIRV_TOOLS_ROOT}/bin/spirv-val"
    "METAL_TOOLCHAIN|${KALANDRA_METAL_TOOLCHAIN}" "INCLUDE|${PROJECT_SOURCE_DIR}/native/metal"
    "METAL_DEBUG|$<TARGET_FILE:kalandra-metal-debug>" "CORE_DEBUG|$<TARGET_FILE:kalandra-native-runtime>"
    "METAL_OPTIMIZED|$<TARGET_FILE:kalandra-metal-optimized>" "CORE_OPTIMIZED|$<TARGET_FILE:kalandra-task-core-optimized>"
    "METAL_SANITIZED|$<TARGET_FILE:kalandra-metal-sanitized>" "CORE_SANITIZED|$<TARGET_FILE:kalandra-native-runtime-sanitized>"
    "METAL_THREAD_SANITIZED|$<TARGET_FILE:kalandra-metal-thread-sanitized>" "CORE_THREAD_SANITIZED|$<TARGET_FILE:kalandra-native-runtime-thread-sanitized>")
  string(REPLACE "|" ";" PARTS "${PAIR}")
  list(GET PARTS 0 KEY)
  list(GET PARTS 1 VALUE)
  string(APPEND TOOLCHAIN_HEADER "#define KALANDRA_GPU_${KEY} \"${VALUE}\"\n")
endforeach()
file(GENERATE OUTPUT "${CMAKE_CURRENT_BINARY_DIR}/Toolchain.h" CONTENT "${TOOLCHAIN_HEADER}")
target_include_directories(kalandra-metal-source-backend PRIVATE "${CMAKE_CURRENT_BINARY_DIR}")
add_dependencies(kalandra-metal-source-backend kalandra-metal-strict kalandra-metal-extract
  kalandra-metal-debug kalandra-metal-optimized kalandra-metal-sanitized kalandra-metal-thread-sanitized)
if(BUILD_TESTING)
  target_include_directories(kalandra-metal-source-compiler-sanitized PRIVATE "${CMAKE_CURRENT_BINARY_DIR}")
endif()
if(BUILD_TESTING)
  add_test(NAME native-metal-source-cli-build COMMAND "${CMAKE_COMMAND}"
    "-DCOMPILER=$<TARGET_FILE:kalandra-metal-source>" "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}"
    "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}" -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyBuild.cmake")
  set_tests_properties(native-metal-source-cli-build PROPERTIES TIMEOUT 120 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
    set(CPU_FLAGS)
    if(VARIANT STREQUAL "sanitized")
      set(CPU_OPTION --sanitize)
      set(CPU_FLAGS -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
    elseif(VARIANT STREQUAL "thread-sanitized")
      set(CPU_OPTION --thread-sanitize)
      set(CPU_FLAGS -O1 -g -fsanitize=thread -fno-omit-frame-pointer)
    elseif(VARIANT STREQUAL "optimized")
      set(CPU_OPTION -O2)
      set(CPU_FLAGS -O2)
    else()
      set(CPU_OPTION -O0)
      set(CPU_FLAGS -O0)
    endif()
    set(CPU_BASE "${CMAKE_CURRENT_BINARY_DIR}/cpu-consumer-${VARIANT}")
    add_custom_command(OUTPUT "${CPU_BASE}.o" "${CPU_BASE}.ll"
      COMMAND $<TARGET_FILE:kalandrac> "${CMAKE_CURRENT_SOURCE_DIR}/cpu-consumer.kalandra"
        -o "${CPU_BASE}" --emit-llvm "${CPU_BASE}.ll" --test-entry total ${CPU_OPTION}
      COMMAND "${CMAKE_CXX_COMPILER}" -Wno-override-module -ffp-contract=off ${CPU_FLAGS}
        -c "${CPU_BASE}.ll" -o "${CPU_BASE}.o"
      DEPENDS kalandrac cpu-consumer.kalandra VERBATIM)
    set_source_files_properties("${CPU_BASE}.o" PROPERTIES GENERATED TRUE EXTERNAL_OBJECT TRUE)
    add_executable(kalandra-metal-interop-${VARIANT} InteropTests.cpp "${CPU_BASE}.o")
    target_include_directories(kalandra-metal-interop-${VARIANT} PRIVATE ../metal)
    target_compile_options(kalandra-metal-interop-${VARIANT} PRIVATE -Wall -Wextra -Werror -ffp-contract=off ${CPU_FLAGS})
    target_link_options(kalandra-metal-interop-${VARIANT} PRIVATE ${CPU_FLAGS})
    target_link_libraries(kalandra-metal-interop-${VARIANT} PRIVATE kalandra-metal-${VARIANT})
    add_dependencies(kalandra-metal-interop-${VARIANT} native-metal-source-shader-placed)
    add_test(NAME native-metal-interop-${VARIANT} COMMAND kalandra-metal-interop-${VARIANT} "${CMAKE_CURRENT_BINARY_DIR}/placed")
    set_tests_properties(native-metal-interop-${VARIANT} PROPERTIES TIMEOUT 60 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
  endforeach()
  add_test(NAME native-unified-metal-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/unified-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyUnified.cmake")
  set_tests_properties(native-unified-metal-cli PROPERTIES TIMEOUT 60 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  foreach(FIXTURE IN ITEMS mixed tensor-results shared-helpers scalar-entry matrix-elementwise differences arguments unused-inputs indirect-arguments tensor-negation division host-expressions cpu-spawn nested-parallel recovery resumable-helpers reduction matmul)
    if(FIXTURE STREQUAL "mixed")
      set(HARNESS MixedTests.cpp)
    elseif(FIXTURE STREQUAL "recovery" OR FIXTURE STREQUAL "resumable-helpers")
      set(HARNESS RecoveryTests.cpp)
    elseif(FIXTURE STREQUAL "nested-parallel")
      set(HARNESS NestedParallelTests.cpp)
    elseif(FIXTURE STREQUAL "cpu-spawn")
      set(HARNESS CpuSpawnTests.cpp)
    elseif(FIXTURE STREQUAL "host-expressions")
      set(HARNESS HostExpressionTests.cpp)
    elseif(FIXTURE STREQUAL "matmul")
      set(HARNESS MatmulTests.cpp)
    elseif(FIXTURE STREQUAL "reduction")
      set(HARNESS ReductionTests.cpp)
    else()
      set(HARNESS TensorResultTests.cpp)
    endif()
    foreach(VARIANT IN ITEMS debug optimized sanitized thread-sanitized)
      set(MIXED_OPTION)
      set(MIXED_FLAGS -O0)
      if(VARIANT STREQUAL "sanitized")
        set(MIXED_OPTION --sanitize)
        set(MIXED_FLAGS -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=all -fno-omit-frame-pointer)
      elseif(VARIANT STREQUAL "thread-sanitized")
        set(MIXED_OPTION --thread-sanitize)
        set(MIXED_FLAGS -O1 -g -fsanitize=thread -fno-omit-frame-pointer)
      elseif(VARIANT STREQUAL "optimized")
        set(MIXED_OPTION -O2)
        set(MIXED_FLAGS -O2)
      endif()
      set(MIXED_DIR "${CMAKE_CURRENT_BINARY_DIR}/${FIXTURE}-${VARIANT}")
      add_custom_command(OUTPUT "${MIXED_DIR}/host.cpp" "${MIXED_DIR}/placement.ir" "${MIXED_DIR}/continuation.plan" "${MIXED_DIR}/cpu.ll" "${MIXED_DIR}/cpu.o" "${MIXED_DIR}/kernel0.metallib"
        COMMAND $<TARGET_FILE:kalandra-metal-source> "${CMAKE_CURRENT_SOURCE_DIR}/${FIXTURE}.kalandra" -o "${MIXED_DIR}" --build ${MIXED_OPTION}
        COMMAND "${CMAKE_CXX_COMPILER}" -Wno-override-module -ffp-contract=off ${MIXED_FLAGS} -c "${MIXED_DIR}/cpu.ll" -o "${MIXED_DIR}/cpu.o"
        DEPENDS kalandra-metal-source "${FIXTURE}.kalandra" VERBATIM)
      set_source_files_properties("${MIXED_DIR}/cpu.o" PROPERTIES GENERATED TRUE EXTERNAL_OBJECT TRUE)
      add_executable(kalandra-metal-${FIXTURE}-${VARIANT} ${HARNESS} "${MIXED_DIR}/cpu.o" "${MIXED_DIR}/host.cpp")
      set_source_files_properties("${MIXED_DIR}/host.cpp" PROPERTIES HEADER_FILE_ONLY TRUE)
      target_include_directories(kalandra-metal-${FIXTURE}-${VARIANT} PRIVATE ../metal "${MIXED_DIR}")
      target_compile_options(kalandra-metal-${FIXTURE}-${VARIANT} PRIVATE -Wall -Wextra -Werror -ffp-contract=off ${MIXED_FLAGS})
      target_link_options(kalandra-metal-${FIXTURE}-${VARIANT} PRIVATE ${MIXED_FLAGS})
      target_link_libraries(kalandra-metal-${FIXTURE}-${VARIANT} PRIVATE kalandra-metal-${VARIANT})
      if(FIXTURE STREQUAL "division")
        target_compile_definitions(kalandra-metal-${FIXTURE}-${VARIANT} PRIVATE KALANDRA_DIVISION)
      endif()
      if(FIXTURE STREQUAL "tensor-negation")
        target_compile_definitions(kalandra-metal-${FIXTURE}-${VARIANT} PRIVATE KALANDRA_TENSOR_NEGATION)
      endif()
      if(FIXTURE STREQUAL "indirect-arguments")
        target_compile_definitions(kalandra-metal-${FIXTURE}-${VARIANT} PRIVATE KALANDRA_INDIRECT_ARGUMENTS)
      endif()
      if(FIXTURE STREQUAL "unused-inputs")
        target_compile_definitions(kalandra-metal-${FIXTURE}-${VARIANT} PRIVATE KALANDRA_UNUSED_INPUTS)
      endif()
      if(FIXTURE STREQUAL "arguments")
        target_compile_definitions(kalandra-metal-${FIXTURE}-${VARIANT} PRIVATE KALANDRA_ARGUMENTS)
      endif()
      if(FIXTURE STREQUAL "differences")
        target_compile_definitions(kalandra-metal-${FIXTURE}-${VARIANT} PRIVATE KALANDRA_DIFFERENCES)
      endif()
      if(FIXTURE STREQUAL "matrix-elementwise")
        target_compile_definitions(kalandra-metal-${FIXTURE}-${VARIANT} PRIVATE KALANDRA_MATRIX_ENTRY)
      endif()
      if(FIXTURE STREQUAL "scalar-entry")
        target_compile_definitions(kalandra-metal-${FIXTURE}-${VARIANT} PRIVATE KALANDRA_SCALAR_ENTRY)
      endif()
      if(FIXTURE STREQUAL "shared-helpers")
        target_compile_definitions(kalandra-metal-${FIXTURE}-${VARIANT} PRIVATE KALANDRA_SHARED_HELPERS)
      endif()
      if(FIXTURE STREQUAL "shared-helpers" OR FIXTURE STREQUAL "scalar-entry" OR FIXTURE STREQUAL "matrix-elementwise" OR FIXTURE STREQUAL "differences" OR FIXTURE STREQUAL "arguments" OR FIXTURE STREQUAL "unused-inputs" OR FIXTURE STREQUAL "indirect-arguments" OR FIXTURE STREQUAL "tensor-negation" OR FIXTURE STREQUAL "division" OR FIXTURE STREQUAL "reduction" OR FIXTURE STREQUAL "matmul")
        target_link_libraries(kalandra-metal-${FIXTURE}-${VARIANT} PRIVATE LLVM)
        target_include_directories(kalandra-metal-${FIXTURE}-${VARIANT} SYSTEM PRIVATE ${LLVM_INCLUDE_DIRS})
      endif()
      add_test(NAME native-metal-${FIXTURE}-${VARIANT} COMMAND kalandra-metal-${FIXTURE}-${VARIANT} "${MIXED_DIR}")
      set_tests_properties(native-metal-${FIXTURE}-${VARIANT} PROPERTIES TIMEOUT 60 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
      if(FIXTURE STREQUAL "matmul" OR FIXTURE STREQUAL "indirect-arguments")
        set_tests_properties(native-metal-${FIXTURE}-${VARIANT} PROPERTIES TIMEOUT 180)
      endif()
    endforeach()
  endforeach()
endif()
if(BUILD_TESTING)
  add_test(NAME native-metal-mixed-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/mixed-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyMixed.cmake")
  set_tests_properties(native-metal-mixed-cli PROPERTIES TIMEOUT 90 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()
if(BUILD_TESTING)
  add_test(NAME native-metal-tensor-results-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/tensor-results-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyTensorResults.cmake")
  set_tests_properties(native-metal-tensor-results-cli PROPERTIES TIMEOUT 90 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()
if(BUILD_TESTING)
  add_test(NAME native-shared-helpers-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/shared-helpers-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyShared.cmake")
  set_tests_properties(native-shared-helpers-cli PROPERTIES TIMEOUT 90 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  add_test(NAME native-scalar-entry-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/scalar-entry-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyScalarEntry.cmake")
  set_tests_properties(native-scalar-entry-cli PROPERTIES TIMEOUT 90 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  add_test(NAME native-reduction-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/reduction-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyReduction.cmake")
  set_tests_properties(native-reduction-cli PROPERTIES TIMEOUT 90 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  add_test(NAME native-matmul-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/matmul-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyMatmul.cmake")
  set_tests_properties(native-matmul-cli PROPERTIES TIMEOUT 90 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()
if(BUILD_TESTING)
  add_test(NAME native-matrix-elementwise-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/matrix-elementwise-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyMatrixElementwise.cmake")
  set_tests_properties(native-matrix-elementwise-cli PROPERTIES TIMEOUT 120 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  add_test(NAME native-differences-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/differences-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyDifferences.cmake")
  set_tests_properties(native-differences-cli PROPERTIES TIMEOUT 180 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  add_test(NAME native-arguments-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/arguments-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyArguments.cmake")
  set_tests_properties(native-arguments-cli PROPERTIES TIMEOUT 180 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  add_test(NAME native-unused-inputs-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/unused-inputs-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyUnusedInputs.cmake")
  set_tests_properties(native-unused-inputs-cli PROPERTIES TIMEOUT 180 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  add_test(NAME native-indirect-arguments-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/indirect-arguments-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyIndirectArguments.cmake")
  set_tests_properties(native-indirect-arguments-cli PROPERTIES TIMEOUT 180 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  add_test(NAME native-tensor-negation-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/tensor-negation-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyTensorNegation.cmake")
  set_tests_properties(native-tensor-negation-cli PROPERTIES TIMEOUT 180 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  add_test(NAME native-division-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/division-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyDivision.cmake")
  set_tests_properties(native-division-cli PROPERTIES TIMEOUT 180 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  add_test(NAME native-host-expressions-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/host-expressions-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyHostExpressions.cmake")
  set_tests_properties(native-host-expressions-cli PROPERTIES TIMEOUT 240 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  add_test(NAME native-cpu-spawn-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/cpu-spawn-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyCpuSpawn.cmake")
  set_tests_properties(native-cpu-spawn-cli PROPERTIES TIMEOUT 240 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  add_test(NAME native-nested-parallel-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/nested-parallel-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyNestedParallel.cmake")
  set_tests_properties(native-nested-parallel-cli PROPERTIES TIMEOUT 240 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  add_test(NAME native-recovery-cli COMMAND "${CMAKE_COMMAND}" "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}" "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/recovery-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyRecovery.cmake")
  set_tests_properties(native-recovery-cli PROPERTIES TIMEOUT 240 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  add_test(NAME native-shared-placement-ir COMMAND "${CMAKE_COMMAND}" "-DCHECKER=$<TARGET_FILE:kalandra-check>"
    "-DCOMPILER=$<TARGET_FILE:kalandra-metal-source>" "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}"
    "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}" -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyPlacement.cmake")
  set_tests_properties(native-shared-placement-ir PROPERTIES TIMEOUT 90)
endif()

if(BUILD_TESTING)
  add_test(NAME native-ir-supervisor-cli COMMAND "${CMAKE_COMMAND}"
    "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DSANITIZED_COMPILER=$<TARGET_FILE:kalandra-metal-source-compiler-sanitized>"
    "-DSOURCE=${CMAKE_CURRENT_SOURCE_DIR}/ir-supervisor.kalandra"
    "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/ir-supervisor-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyIRSupervisor.cmake")
  set_tests_properties(native-ir-supervisor-cli PROPERTIES TIMEOUT 240 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()

if(BUILD_TESTING)
  add_test(NAME native-resumable-helpers-cli COMMAND "${CMAKE_COMMAND}"
    "-DNORMAL_COMPILER=$<TARGET_FILE:kalandra-metal-source>"
    "-DCOMPILER=$<TARGET_FILE:kalandrac>"
    "-DCHECKER=$<TARGET_FILE:kalandra-check>"
    "-DSANITIZED_COMPILER=$<TARGET_FILE:kalandra-metal-source-compiler-sanitized>"
    "-DSOURCE_DIR=${CMAKE_CURRENT_SOURCE_DIR}"
    "-DOUTPUT_DIR=${CMAKE_CURRENT_BINARY_DIR}/resumable-helpers-cli"
    -P "${CMAKE_CURRENT_SOURCE_DIR}/VerifyResumableHelpers.cmake")
  set_tests_properties(native-resumable-helpers-cli PROPERTIES TIMEOUT 240 RESOURCE_LOCK apple-metal-gpu ENVIRONMENT "MTL_DEBUG_LAYER=1")
endif()
