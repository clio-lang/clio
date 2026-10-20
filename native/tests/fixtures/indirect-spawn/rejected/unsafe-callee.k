type Outcome:
  error:TaskError
fn run(error:TaskError)->int ! TaskError:
  outcome=Outcome {error:error}
  f=fn(value:int):
    match outcome.error:
      TaskError.Fault {kind}:value
      _:0
  try parallel:
    try await spawn f(42)
fn main()->int:
  42
