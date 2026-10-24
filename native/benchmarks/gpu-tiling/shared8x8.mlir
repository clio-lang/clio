module attributes {gpu.container_module,
  spirv.target_env = #spirv.target_env<#spirv.vce<v1.0, [Shader, Int64], [SPV_KHR_storage_buffer_storage_class]>, #spirv.resource_limits<>>} {
  gpu.module @kernels {
    spirv.GlobalVariable @atile : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>
    spirv.GlobalVariable @btile : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>
    gpu.func @kalandra_matmul(%a: memref<?xf32>, %b: memref<?xf32>, %output: memref<?xf32>, %parameters: memref<3xi32>)
      kernel attributes {spirv.entry_point_abi = #spirv.entry_point_abi<workgroup_size = [64, 1, 1]>} {
      %atile = spirv.mlir.addressof @atile : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>
      %btile = spirv.mlir.addressof @btile : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>
      %blockx = gpu.block_id x
      %blocky = gpu.block_id y
      %thread = gpu.thread_id x
      %zero = arith.constant 0 : index
      %one = arith.constant 1 : index
      %two = arith.constant 2 : index
      %levels = arith.constant 32 : index
      %z32 = arith.constant 0 : i32
      %o32 = arith.constant 1 : i32
      %false = arith.constant false
      %true = arith.constant true
      %floatzero = arith.bitcast %z32 : i32 to f32
      %m32 = memref.load %parameters[%zero] : memref<3xi32>
      %k32 = memref.load %parameters[%one] : memref<3xi32>
      %n32 = memref.load %parameters[%two] : memref<3xi32>
      %m = arith.index_cast %m32 : i32 to index
      %k = arith.index_cast %k32 : i32 to index
      %n = arith.index_cast %n32 : i32 to index
      %eight = arith.constant 8 : index
      %three = arith.constant 3 : index
      %localrow = arith.divui %thread, %eight : index
      %localcol = arith.remui %thread, %eight : index
      %baserow = arith.muli %blocky, %eight : index
      %basecol = arith.muli %blockx, %eight : index
      %rowsleft = arith.subi %m, %baserow : index
      %colsleft = arith.subi %n, %basecol : index
      %validrow = arith.cmpi ult, %localrow, %rowsleft : index
      %validcol = arith.cmpi ult, %localcol, %colsleft : index
      %valid = arith.andi %validrow, %validcol : i1
      %row = arith.addi %baserow, %localrow : index
      %column = arith.addi %basecol, %localcol : index
      %rowbase = arith.muli %row, %k : index
      %outbase = arith.muli %row, %n : index
      %cell = arith.addi %outbase, %column : index
      %stack = memref.alloca() : memref<32xf32, #spirv.storage_class<Function>>
      %chunks = arith.divui %k, %eight : index
      %complete = arith.muli %chunks, %eight : index
      scf.for %chunk = %zero to %chunks step %one {
        %offset = arith.muli %chunk, %eight : index
        %ac = arith.addi %offset, %localcol : index
        %br = arith.addi %offset, %localrow : index
        %ai = arith.addi %rowbase, %ac : index
        %bi0 = arith.muli %br, %n : index
        %bi = arith.addi %bi0, %column : index
        %av = scf.if %validrow -> f32 {
          %v = memref.load %a[%ai] : memref<?xf32>
          scf.yield %v : f32
        } else {
          scf.yield %floatzero : f32
        }
        %bv = scf.if %validcol -> f32 {
          %v = memref.load %b[%bi] : memref<?xf32>
          scf.yield %v : f32
        } else {
          scf.yield %floatzero : f32
        }
        %atile_i = arith.index_cast %thread : index to i32
        %atile_p = spirv.AccessChain %atile[%atile_i] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
        spirv.Store "Workgroup" %atile_p, %av : f32
        %btile_i = arith.index_cast %thread : index to i32
        %btile_p = spirv.AccessChain %btile[%btile_i] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
        spirv.Store "Workgroup" %btile_p, %bv : f32
        gpu.barrier
        scf.if %valid {
          %c0 = arith.constant 0 : index
          %ar0 = arith.muli %localrow, %eight : index
          %at0 = arith.addi %ar0, %c0 : index
          %br0 = arith.muli %c0, %eight : index
          %bt0 = arith.addi %br0, %localcol : index
          %aidx0 = arith.index_cast %at0 : index to i32
          %aptr0 = spirv.AccessChain %atile[%aidx0] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
          %a0 = spirv.Load "Workgroup" %aptr0 : f32
          %bidx0 = arith.index_cast %bt0 : index to i32
          %bptr0 = spirv.AccessChain %btile[%bidx0] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
          %b0 = spirv.Load "Workgroup" %bptr0 : f32
          %p0 = arith.mulf %a0, %b0 : f32
          %c1 = arith.constant 1 : index
          %ar1 = arith.muli %localrow, %eight : index
          %at1 = arith.addi %ar1, %c1 : index
          %br1 = arith.muli %c1, %eight : index
          %bt1 = arith.addi %br1, %localcol : index
          %aidx1 = arith.index_cast %at1 : index to i32
          %aptr1 = spirv.AccessChain %atile[%aidx1] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
          %a1 = spirv.Load "Workgroup" %aptr1 : f32
          %bidx1 = arith.index_cast %bt1 : index to i32
          %bptr1 = spirv.AccessChain %btile[%bidx1] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
          %b1 = spirv.Load "Workgroup" %bptr1 : f32
          %p1 = arith.mulf %a1, %b1 : f32
          %c2 = arith.constant 2 : index
          %ar2 = arith.muli %localrow, %eight : index
          %at2 = arith.addi %ar2, %c2 : index
          %br2 = arith.muli %c2, %eight : index
          %bt2 = arith.addi %br2, %localcol : index
          %aidx2 = arith.index_cast %at2 : index to i32
          %aptr2 = spirv.AccessChain %atile[%aidx2] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
          %a2 = spirv.Load "Workgroup" %aptr2 : f32
          %bidx2 = arith.index_cast %bt2 : index to i32
          %bptr2 = spirv.AccessChain %btile[%bidx2] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
          %b2 = spirv.Load "Workgroup" %bptr2 : f32
          %p2 = arith.mulf %a2, %b2 : f32
          %c3 = arith.constant 3 : index
          %ar3 = arith.muli %localrow, %eight : index
          %at3 = arith.addi %ar3, %c3 : index
          %br3 = arith.muli %c3, %eight : index
          %bt3 = arith.addi %br3, %localcol : index
          %aidx3 = arith.index_cast %at3 : index to i32
          %aptr3 = spirv.AccessChain %atile[%aidx3] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
          %a3 = spirv.Load "Workgroup" %aptr3 : f32
          %bidx3 = arith.index_cast %bt3 : index to i32
          %bptr3 = spirv.AccessChain %btile[%bidx3] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
          %b3 = spirv.Load "Workgroup" %bptr3 : f32
          %p3 = arith.mulf %a3, %b3 : f32
          %c4 = arith.constant 4 : index
          %ar4 = arith.muli %localrow, %eight : index
          %at4 = arith.addi %ar4, %c4 : index
          %br4 = arith.muli %c4, %eight : index
          %bt4 = arith.addi %br4, %localcol : index
          %aidx4 = arith.index_cast %at4 : index to i32
          %aptr4 = spirv.AccessChain %atile[%aidx4] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
          %a4 = spirv.Load "Workgroup" %aptr4 : f32
          %bidx4 = arith.index_cast %bt4 : index to i32
          %bptr4 = spirv.AccessChain %btile[%bidx4] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
          %b4 = spirv.Load "Workgroup" %bptr4 : f32
          %p4 = arith.mulf %a4, %b4 : f32
          %c5 = arith.constant 5 : index
          %ar5 = arith.muli %localrow, %eight : index
          %at5 = arith.addi %ar5, %c5 : index
          %br5 = arith.muli %c5, %eight : index
          %bt5 = arith.addi %br5, %localcol : index
          %aidx5 = arith.index_cast %at5 : index to i32
          %aptr5 = spirv.AccessChain %atile[%aidx5] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
          %a5 = spirv.Load "Workgroup" %aptr5 : f32
          %bidx5 = arith.index_cast %bt5 : index to i32
          %bptr5 = spirv.AccessChain %btile[%bidx5] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
          %b5 = spirv.Load "Workgroup" %bptr5 : f32
          %p5 = arith.mulf %a5, %b5 : f32
          %c6 = arith.constant 6 : index
          %ar6 = arith.muli %localrow, %eight : index
          %at6 = arith.addi %ar6, %c6 : index
          %br6 = arith.muli %c6, %eight : index
          %bt6 = arith.addi %br6, %localcol : index
          %aidx6 = arith.index_cast %at6 : index to i32
          %aptr6 = spirv.AccessChain %atile[%aidx6] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
          %a6 = spirv.Load "Workgroup" %aptr6 : f32
          %bidx6 = arith.index_cast %bt6 : index to i32
          %bptr6 = spirv.AccessChain %btile[%bidx6] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
          %b6 = spirv.Load "Workgroup" %bptr6 : f32
          %p6 = arith.mulf %a6, %b6 : f32
          %c7 = arith.constant 7 : index
          %ar7 = arith.muli %localrow, %eight : index
          %at7 = arith.addi %ar7, %c7 : index
          %br7 = arith.muli %c7, %eight : index
          %bt7 = arith.addi %br7, %localcol : index
          %aidx7 = arith.index_cast %at7 : index to i32
          %aptr7 = spirv.AccessChain %atile[%aidx7] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
          %a7 = spirv.Load "Workgroup" %aptr7 : f32
          %bidx7 = arith.index_cast %bt7 : index to i32
          %bptr7 = spirv.AccessChain %btile[%bidx7] : !spirv.ptr<!spirv.array<64 x f32>, Workgroup>, i32 -> !spirv.ptr<f32, Workgroup>
          %b7 = spirv.Load "Workgroup" %bptr7 : f32
          %p7 = arith.mulf %a7, %b7 : f32
          %s0_0 = arith.addf %p0, %p1 : f32
          %s0_1 = arith.addf %p2, %p3 : f32
          %s0_2 = arith.addf %p4, %p5 : f32
          %s0_3 = arith.addf %p6, %p7 : f32
          %s1_0 = arith.addf %s0_0, %s0_1 : f32
          %s1_1 = arith.addf %s0_2, %s0_3 : f32
          %s2_0 = arith.addf %s1_0, %s1_1 : f32
          %bits = arith.index_cast %chunk : index to i32
          %level, %remaining, %carry = scf.while (%l = %three, %r = %bits, %v = %s2_0) : (index, i32, f32) -> (index, i32, f32) {
            %odd = arith.andi %r, %o32 : i32
            %occupied = arith.cmpi ne, %odd, %z32 : i32
            scf.condition(%occupied) %l, %r, %v : index, i32, f32
          } do {
          ^bb0(%l: index, %r: i32, %v: f32):
            %previous = memref.load %stack[%l] : memref<32xf32, #spirv.storage_class<Function>>
            %sum = arith.addf %previous, %v : f32
            %nextlevel = arith.addi %l, %one : index
            %nextbits = arith.shrui %r, %o32 : i32
            scf.yield %nextlevel, %nextbits, %sum : index, i32, f32
          }
          memref.store %carry, %stack[%level] : memref<32xf32, #spirv.storage_class<Function>>
        }
        gpu.barrier
      }
      scf.if %valid {
        scf.for %i = %complete to %k step %one {
          %ai = arith.addi %rowbase, %i : index
          %bi0 = arith.muli %i, %n : index
          %bi = arith.addi %bi0, %column : index
          %av = memref.load %a[%ai] : memref<?xf32>
          %bv = memref.load %b[%bi] : memref<?xf32>
          %product = arith.mulf %av, %bv : f32
          %bits = arith.index_cast %i : index to i32
          %level, %remaining, %carry = scf.while (%l = %zero, %r = %bits, %v = %product) : (index, i32, f32) -> (index, i32, f32) {
            %odd = arith.andi %r, %o32 : i32
            %occupied = arith.cmpi ne, %odd, %z32 : i32
            scf.condition(%occupied) %l, %r, %v : index, i32, f32
          } do {
          ^bb0(%l: index, %r: i32, %v: f32):
            %previous = memref.load %stack[%l] : memref<32xf32, #spirv.storage_class<Function>>
            %sum = arith.addf %previous, %v : f32
            %nextlevel = arith.addi %l, %one : index
            %nextbits = arith.shrui %r, %o32 : i32
            scf.yield %nextlevel, %nextbits, %sum : index, i32, f32
          }
          memref.store %carry, %stack[%level] : memref<32xf32, #spirv.storage_class<Function>>
        }
        %result, %seen = scf.for %l = %zero to %levels step %one iter_args(%acc = %floatzero, %used = %false) -> (f32, i1) {
          %shift = arith.index_cast %l : index to i32
          %mask = arith.shli %o32, %shift : i32
          %occupied = arith.andi %k32, %mask : i32
          %present = arith.cmpi ne, %occupied, %z32 : i32
          %next, %nextused = scf.if %present -> (f32, i1) {
            %root = memref.load %stack[%l] : memref<32xf32, #spirv.storage_class<Function>>
            %combined = scf.if %used -> f32 {
              %sum = arith.addf %root, %acc : f32
              scf.yield %sum : f32
            } else {
              scf.yield %root : f32
            }
            scf.yield %combined, %true : f32, i1
          } else {
            scf.yield %acc, %used : f32, i1
          }
          scf.yield %next, %nextused : f32, i1
        }
        memref.store %result, %output[%cell] : memref<?xf32>
      }
      gpu.return
    }
  }
}
