fn double(value:int)->int:
  value*2
fn apply(value:int,f:fn(int)->int)->int:
  f(value)
type Outcome:
  error:TaskError
fn unsafe(error:TaskError)->fn(int)->int:
  outcome=Outcome {error:error}
  fn(value:int):
    match outcome.error:
      TaskError.Fault {kind}:value
      _:0
fn identity(f:fn(int)->int)->fn(int)->int:
  f
fn consume(error:TaskError)->int ! TaskError:
  factory=if true:identity
  else:fn(f:fn(int)->int):f
  f=factory(unsafe(error))
  try parallel:
    try await spawn apply(42,f)
fn main()->int:
  42
