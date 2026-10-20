fn leaf(value:int)->int:
  value
fn run(value:int)->int ! TaskError:
  if value==0:
    try parallel:
      try await spawn leaf(value)
  else:
    f=run
    try f(value-1)
fn main()->int ! TaskError:
  f=run
  try f(1)
