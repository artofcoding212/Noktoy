// deno-lint-ignore-file require-await
import { Interpreter, Scope, Variable } from "../backend/interpreter.ts";
import { AnyType, TypeType } from "../shared/types.ts";
import { FunValue, NativeFunValue, NoneValue, NumberValue, Value, ValueType } from "../shared/values.ts";

export const time_lib: Map<string, Variable> = new Map();

/*

Std::Time
|> Standard library entry for interacting with time-based operations.

Contributors
* artofcoding212 (Github & Discord)

Documentation
[YIELDS] sleep(seconds: Number)
   | Halts current thread execution for `seconds` seconds.
[YIELDS] sleepms(ms: Number)
   | Halts current thread execution for `ms` milliseconds.
now() Number
   | Returns the number of milliseconds elapsed since midnight, January 1, 1970 Universal Coordinated Time (UTC).
unixTime() Number
   | Returns Time::now() converted into Unix time.
measure(fn: fun() Any) Number
   | Returns the amount of milliseconds that the `fn` took to execute.

*/

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

time_lib.set('sleep', { mutable: false, type: {type:TypeType.Any} as AnyType, value: { type: ValueType.Native, body:
    async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (args.length != 1 || args[0].type != ValueType.Number) {
            throw `invalid function signature to Std::Time::sleep`;
        }

        await sleep((args[0] as NumberValue).value*1000);

        return { type: ValueType.None } as NoneValue;
    }
} as NativeFunValue });

time_lib.set('sleepms', { mutable: false, type: {type:TypeType.Any} as AnyType, value: { type: ValueType.Native, body:
    async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (args.length != 1 || args[0].type != ValueType.Number) {
            throw `invalid function signature to Std::Time::sleepms`;
        }

        await sleep((args[0] as NumberValue).value);

        return { type: ValueType.None } as NoneValue;
    }
} as NativeFunValue });

time_lib.set('now', { mutable: false, type: {type:TypeType.Any} as AnyType, value: { type: ValueType.Native, body:
    async (_args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        return { type: ValueType.Number, value: Date.now() } as NumberValue;
    }
} as NativeFunValue });

time_lib.set('unixTime', { mutable: false, type: {type:TypeType.Any} as AnyType, value: { type: ValueType.Native, body:
    async (_args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        return { type: ValueType.Number, value: Math.floor(Date.now() / 1000) } as NumberValue;
    }
} as NativeFunValue });

time_lib.set('measure', { mutable: false, type: {type:TypeType.Any} as AnyType, value: { type: ValueType.Native, body:
    async (args: Value[], _scope: Scope, i: Interpreter): Promise<Value> => {
        if (args.length != 1 || args[0].type != ValueType.Fun) {
            throw `invalid function signature to Std::Time::measure`;
        }

        const start = performance.now();
        await i.runFun(args[0] as FunValue, [], _scope);
        
        return { type: ValueType.Number, value: performance.now() - start } as NumberValue;
    }
} as NativeFunValue });