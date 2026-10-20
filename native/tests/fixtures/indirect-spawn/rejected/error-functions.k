fn double(value:int)->int:
  value*2
error E:
  Bad:
    callback:fn(int)->int
fn failer()->int ! E:
  fail E.Bad {callback:double}
fn main()->int ! (E | TaskError):
  f=failer
  try parallel:
    try await spawn f()
