#[macro_use]
extern crate neon;

use neon::prelude::*;

fn isSupportedNodeVersion(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let versionText = cx.argument::<JsString>(0)?.value();
    let versionParts = versionText.split('.').collect::<Vec<&str>>();

    let major = versionParts[0].to_string().parse::<i32>().unwrap_or(0);
    let minor = versionParts[1].to_string().parse::<i32>().unwrap_or(0);
    Ok(cx.boolean(major > 10 || (major == 10 && minor >= 4)))
}

register_module!(mut cx, {
    cx.export_function("isSupportedNodeVersion", isSupportedNodeVersion)
});
