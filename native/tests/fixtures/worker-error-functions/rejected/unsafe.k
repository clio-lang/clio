type Outcome:
  error:TaskError
error E:
  Retry:
    callback:fn(int)->int
fn unsafe(error:TaskError)->fn(int)->int:
  outcome=Outcome {error:error}
  fn(value:int):
    match outcome.error:
      TaskError.Fault {kind}:value
      _:0
fn worker(error:TaskError,flag:Bool)->int ! E:
  fail E.Retry {callback:unsafe(error)}
fn submit(error:TaskError)->int ! (E | TaskError):
  try parallel:
    try await spawn worker(error,true)
fn main()->int:
  42
