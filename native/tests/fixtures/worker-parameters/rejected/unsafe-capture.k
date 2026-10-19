type Outcome:
  error:TaskError
fn apply(value:int,f:fn(int)->int)->int:
  f(value)
fn wrap(error:TaskError)->fn(int)->int:
  outcome=Outcome {error:error}
  fn(value:int):
    match outcome.error:
      TaskError.Fault {kind}:value
      _:0
fn forward(f:fn(int)->int)->int ! TaskError:
  try parallel:
    try await spawn apply(42,f)
fn run()->int ! TaskError:
  try parallel:
    try await spawn apply(42,fn(value:int):value)
fn main()->int:
  run() catch fn(error):
    forward(wrap(error)) catch fn(other):0
