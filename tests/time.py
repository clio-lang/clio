#!/usr/bin/env python3

import subprocess
import sys
import time

if len(sys.argv) == 1 or sys.argv[1] in ('-h', '--help'):
    sys.exit(0)

start = time.time()
process = subprocess.run(sys.argv[1:])
end = time.time()

print('Time %g' % (end - start))

sys.exit(process.returncode)
