// deno-lint-ignore-file require-await
import { Interpreter, Scope, Variable } from "../backend/interpreter.ts";
import { ValueType, NativeFunValue, NoneValue, StringValue, tostring, Value } from '../shared/values.ts';
import { AnyType, TypeType } from "../shared/types.ts";

export const io_lib: Map<string, Variable> = new Map();
const enc = new TextEncoder();

/*

Std::Io
|> Standard library entry for interacting with the input (i.e. keyboard) and output (i.e. stdout, file system)

Contributors
* artofcoding212 (Github & Discord)

Documentation
* println(...Any) None
   | Concatenates the stringified versions of all of the given arguments and prints them with a trailing newline.
* print(...Any) None
   | Concatenates the stringified versions of all of the given arguments and prints them with NO trailing newline.
* prompt() String | None
* prompt(msg: String) String | None
* prompt(msg: String, default: String) String | None
   | Yields until the user types in a string and presses the enter key. Returns none if interrupted.
   | If a given `msg` is specified, it will print() this with a space before prompting.
   | If a given `default` is specified, it will automatically input this for the user.

*/

io_lib.set("println", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
    type: ValueType.Native,
    body: async (args: Value[], _scope: Scope, i: Interpreter) => {
        let buf = '';
        for (const arg of args) {
            buf = buf+tostring(arg, i);
        }

        console.log(buf);
        return { type: ValueType.None } as NoneValue;
    }
} as NativeFunValue })

io_lib.set("print", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
    type: ValueType.Native,
    body: async (args: Value[], _scope: Scope, i: Interpreter) => {
        let buf = '';
        for (const arg of args) {
            buf = buf+tostring(arg, i);
        }

        await Deno.stdout.write(enc.encode(buf));
        return { type: ValueType.None } as NoneValue;
    }
} as NativeFunValue })

io_lib.set("prompt", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
    type: ValueType.Native,
    body: async (args: Value[], _scope: Scope, _i: Interpreter) => {
        const msg = args[0];
        if (msg != undefined && msg.type != ValueType.String) {
            throw 'invalid Std::Io::prompt() signature';
        }
        const def = args[1];
        if (def != undefined && def.type != ValueType.String) {
            throw 'invalid Std::Io::prompt() signature';
        }
        const res = prompt(msg == undefined ? undefined : (msg as StringValue).value, def == undefined ? undefined : (def as StringValue).value);
        if (res==null) {
            return { type: ValueType.None } as NoneValue;
        }
        return { type: ValueType.String, value: res } as StringValue;
    }
} as NativeFunValue })