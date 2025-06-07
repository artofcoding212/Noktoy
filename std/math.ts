// deno-lint-ignore-file require-await
import { Interpreter, Scope, Variable } from "../backend/interpreter.ts";
import { AnyType, NumberType, TypeType } from "../shared/types.ts";
import { ValueType, NativeFunValue, Value, NumberValue } from "../shared/values.ts";

export const math_lib: Map<string, Variable> = new Map();

/*

Std::Math
|> Standard library entry for mathematical functions and constants.

Contributors
* artofcoding212 (Github & Discord)

Documentation
* sin(x: Number) Number
   | Returns the sine of x, assumed to be in radians.
* cos(x: Number) Number
   | Returns the cosine of x, assumed to be in radians.
* rad(x: Number) Number
   | Returns x, assumed to be in degrees, in radians.
* deg(x: Number) Number
   | Returns x, assumed to be in radians, in degrees.
* max(...Number) Number
   | Returns the largest number out of the arguments.
* min(...Number) Number
   | Returns the smallest number out of the arguments.s
* floor(x: Number) Number
   | Returns the number x without the decimal digits.
* ceil(x: Number) Number
   | Returns floor(x)+1.
* sqrt(x: Number) Number
   | Returns the square root of x.
* round(x: Number) Number
   | Returns x with its decimal digits rounded.
* or(a: Number, b: Number) Number
   | Returns a||b.
* pi: Number
   | The ratio of a circle's circumference to its diameter.

*/

const singleArgFun = (name: string, fun: (x: number) => number) => {
   math_lib.set(name, {mutable: false, type: { type: TypeType.Any } as AnyType, value: {
      type: ValueType.Native,
      body: async (args: Value[], _scope: Scope, _i: Interpreter) => {
         if (args.length != 1 || args[0].type != ValueType.Number) {
            throw `invalid Std::Math::${name}() function signature`;
         }
         return { type: ValueType.Number, value: fun((args[0] as NumberValue).value) } as NumberValue;
      }
   } as NativeFunValue})
}

const twoArgFun = (name: string, fun: (x: number, y: number) => number) => {
   math_lib.set(name, {mutable: false, type: { type: TypeType.Any } as AnyType, value: {
      type: ValueType.Native,
      body: async (args: Value[], _scope: Scope, _i: Interpreter) => {
         if (args.length != 2 || args[0].type != ValueType.Number || args[1].type != ValueType.Number) {
            throw `invalid Std::Math::${name}() function signature`;
         }
         return { type: ValueType.Number, value: fun((args[0] as NumberValue).value, (args[1] as NumberValue).value) } as NumberValue;
      }
   } as NativeFunValue})
}

const valuesFun = (name: string, fun: (...args: number[]) => number) => {
   math_lib.set(name, {mutable: false, type: { type: TypeType.Any } as AnyType, value: {
      type: ValueType.Native,
      body: async (args: Value[], _scope: Scope, _i: Interpreter) => {
         if (args.length == 0) {
            throw `invalid Std::Math::${name}() function signature`;
         }
         const list: number[] = [];
         for (const arg of args) {
            if (arg.type != ValueType.Number) {
               throw `invalid Std::Math::${name}() function signature`;
            }
            list.push((arg as NumberValue).value);
         }
         return { type: ValueType.Number, value: fun(...list) } as NumberValue;
      }
   } as NativeFunValue})
}

singleArgFun('cos', Math.cos);
singleArgFun('sin', Math.sin);
singleArgFun('floor', Math.floor);
singleArgFun('ceil', Math.ceil);
singleArgFun('round', Math.round);
singleArgFun('sqrt', Math.sqrt);
singleArgFun('rad', (x: number) => x * (Math.PI / 180));
singleArgFun('deg', (x: number) => x * (180 / Math.PI));
twoArgFun('or', (a: number, b: number) => a||b);
valuesFun('max', Math.max);
valuesFun('min', Math.min);

math_lib.set("pi", { 
   mutable: false, type: { type: TypeType.Number } as NumberType, 
   value: { type: ValueType.Number, value: Math.PI } as NumberValue,
})