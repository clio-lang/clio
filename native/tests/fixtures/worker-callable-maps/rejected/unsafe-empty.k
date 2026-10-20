type Outcome:
  error:TaskError
fn unsafe(error:TaskError)->fn(int)->int:
  outcome=Outcome {error:error}
  fn(value:int):
    match outcome.error:
      TaskError.Fault {kind}:value
      _:0
fn consume(error:TaskError)->int ! TaskError:
  input:[int]=[]
  f=unsafe(error)
  try parallel:
    values=try await spawn map(input,f)
    length(values)
fn main()->int:
  42
