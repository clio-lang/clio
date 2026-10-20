type Outcome:
  error:TaskError
fn unsafe(error:TaskError)->fn(int)->int:
  outcome=Outcome {error:error}
  fn(value:int):
    match outcome.error:
      TaskError.Fault {kind}:value
      _:0
fn run(error:TaskError)->[int] ! TaskError:
  input:[int]=[]
  callback=unsafe(error)
  try parallelMap(input,callback)
fn main()->int:
  42
