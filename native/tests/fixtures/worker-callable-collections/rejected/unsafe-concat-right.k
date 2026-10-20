type Outcome:
  error:TaskError
fn unsafe(error:TaskError)->fn(int)->int:
  outcome=Outcome {error:error}
  fn(value:int):
    match outcome.error:
      TaskError.Fault {kind}:value
      _:0
fn consume(error:TaskError)->int ! TaskError:
  callbacks=[unsafe(error)]
  good=[fn(value:int):value]
  try parallel:
    values=try await spawn concat(good,callbacks)
    length(values)
fn main()->int:
  42
