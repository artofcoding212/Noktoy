// deno-lint-ignore-file require-await
import { Interpreter, Scope, Variable } from "../backend/interpreter.ts";
import { AnyType, ArrayType, TupleType, TypeType } from "../shared/types.ts";
import { ArrayValue, FunValue, NativeFunValue, NumberValue, Value, ValueType } from "../shared/values.ts";

export const arr_lib: Map<string, Variable> = new Map();

/*

Std::Array
|> Standard library entry for interacting with arrays.

Contributors
* artofcoding212 (Github & Discord)

Documentation
* len(arr: Any[]) Number
   | Returns the length of the array
* fill(count: Number, item: Any) Any[]
   | Returns an array of `count` length with all the items set to `item`.
* push(arr: Any[], item: Any) Any[]
   | Returns a new array with `len(arr)+1` length, where the last element is `item`.
   | To prevent constant variable mutation, it returns a COPY of the original array, similar to Go's push().
* pop(arr: Any[]) [Any[], Any]
   | Returns a tuple. The first element of the tuple is the new array of `len(arr)-1` length. The second element is the last element of the array.
   | To prevent constant variable mutation, it returns a COPY of the original array, similar to Go's pop().
* sort(arr: Any[], fn: fun(a: Any, b: Any) Number) Any[]
   | Sorts the given array with the sorting function.
* splice(arr: Any[], start: Number, count: Number) Any[]
   | Returns a new array with elements start-start+count removed, inserting new elements if needed.
*/

arr_lib.set("len", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
   type: ValueType.Native,
   body: async (args: Value[], _scope: Scope, _i: Interpreter) => {
      if (args.length != 1 || args[0].type != ValueType.Array) {
         throw 'invalid Std::Array::len() function signature';
      }
      
      return { type: ValueType.Number, value: (args[0] as ArrayValue).val.length } as NumberValue;
   }
} as NativeFunValue })

arr_lib.set("sort", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
   type: ValueType.Native,
   body: async (args: Value[], scope: Scope, i: Interpreter) => {
      if (args.length != 2 || args[0].type != ValueType.Array || args[1].type != ValueType.Fun) {
         throw 'invalid Std::Array::sort() function signature';
      }

      const tmp = {...args[0]};
      // Async sort implementation
      const arr = [...(tmp as ArrayValue).val];
      for (let idx = 0; idx < arr.length - 1; idx++) {
         for (let j = 0; j < arr.length - idx - 1; j++) {
            const res = await i.runFun((args[1] as FunValue), [arr[j], arr[j + 1]], scope);
            if (res.type != ValueType.Number) {
               throw 'invalid Std::Array::sort() function signature';
            }
            if ((res as NumberValue).value > 0) {
               const temp = arr[j];
               arr[j] = arr[j + 1];
               arr[j + 1] = temp;
            }
         }
      }
      (tmp as ArrayValue).val = arr;

      return tmp;
   }
} as NativeFunValue })

arr_lib.set("splice", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
   type: ValueType.Native,
   body: async (args: Value[], scope: Scope, i: Interpreter) => {
      if (args.length != 3 || args[0].type != ValueType.Array || args[1].type != ValueType.Number || args[2].type != ValueType.Number) {
         throw 'invalid Std::Array::splice() function signature';
      }

      const tmp = ({...args[0]} as ArrayValue).val;
      tmp.splice((args[1] as NumberValue).value, (args[2] as NumberValue).value);

      return {
         type: ValueType.Array,
         val: tmp,
      } as ArrayValue;
   }
} as NativeFunValue })

arr_lib.set("fill", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
   type: ValueType.Native,
   body: async (args: Value[], _scope: Scope, _i: Interpreter) => {
      if (args.length != 2 || args[0].type != ValueType.Number) {
         throw 'invalid Std::Array::fill() function signature';
      }
      
      return { type: ValueType.Array, val: new Array((args[0] as NumberValue).value).fill(args[1]) } as ArrayValue;
   }
} as NativeFunValue })

arr_lib.set("push", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
   type: ValueType.Native,
   body: async (args: Value[], _scope: Scope, _i: Interpreter) => {
      if (args.length < 2 || args[0].type != ValueType.Array) {
         throw 'invalid Std::Array::push() function signature';
      }

      return { type: ValueType.Array, val: [...(args[0] as ArrayValue).val, ...args.slice(1)]} as ArrayValue;
   }
} as NativeFunValue })

arr_lib.set("pop", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
   type: ValueType.Native,
   body: async (args: Value[], _scope: Scope, _i: Interpreter) => {
      if (args.length != 1 || args[0].type != ValueType.Array) {
         throw 'invalid Std::Array::pop() function signature';
      }

      const old = (args[0] as ArrayValue).val;
      return {
         type: ValueType.Array,
         val: [
               { type: ValueType.Array, val: old.slice(0, old.length - 1) } as ArrayValue,
               old.slice(old.length - 1, old.length)[0],
         ],
         t: { type: TypeType.Tuple, a: [ 
            { type: TypeType.Array, t: { type: TypeType.Any } as AnyType } as ArrayType,
            { type: TypeType.Any } as AnyType
         ]} as TupleType,
      } as ArrayValue;
   }
} as NativeFunValue })