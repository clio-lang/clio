type Outcome:
  error:TaskError
fn identity(value:int)->int:
  value
fn unsafe(error:TaskError)->(fn(int)->int ! TaskError):
  outcome=Outcome {error:error}
  fn(value:int)->int ! TaskError:
    selected=match outcome.error:
      _:value
    try parallel:
      try await spawn identity(selected)
fn main(error:TaskError)->int ! TaskError:
  callback=unsafe(error)
  try callback(42)
