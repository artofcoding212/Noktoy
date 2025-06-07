// deno-lint-ignore-file require-await
import { Interpreter, Scope, Variable } from "../backend/interpreter.ts";
import { AnyType, TypeType } from "../shared/types.ts";
import { ArrayValue, BoolValue, NativeFunValue, NoneValue, NumberValue, ObjectValue, StringValue, tostring, Value, ValueType } from "../shared/values.ts";

export const str_lib: Map<string, Variable> = new Map();

/*

Std::String
|> Standard library entry for interacting with strings.

Contributors
* artofcoding212 (Github & Discord)

Documentation
* tonumber(str: String) Number|None
   | Attempts to parse the string into a number. This will return none if an error occurred during parsing.
* tostring(...Any) String
   | Converts the given arguments into strings and concatenates them. (implements shared/values.ts's tostring() function)
* split(str: String, sep: String) String[]
   | Splits the string by the separator, returning an array of sliced strings.
* len(str: String) Number
   | Returns the length of the string.
* codeAt(str: String, pos: Number) Number
   | Returns the character code of the character at `pos` in the string.
* encodeText(str: String)
   | Returns an encoded version of the text as an object.
   | Decode with decodeText.
* decodeText(enc_str) String
   | Returns the decoded version of the text.
* isEncoded(a) Bool
   | Returns true if the given value is encoded.

*/

str_lib.set("tonumber", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
   type: ValueType.Native,
   body: async (args: Value[], _scope: Scope, _i: Interpreter) => {
      if (args.length != 1 || args[0].type != ValueType.String) {
         throw 'invalid Std::String::tonumber() function signature';
      }

      const n = Number((args[0] as StringValue).value);
      if (Number.isNaN(n)) {
         return { type: ValueType.None } as NoneValue;
      }
      
      return { type: ValueType.Number, value: n } as NumberValue;
   }
} as NativeFunValue })

str_lib.set("tostring", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
   type: ValueType.Native,
   body: async (args: Value[], _scope: Scope, i: Interpreter) => {
      let buf = '';

      for (const arg of args) {
         buf = buf+tostring(arg, i);
      }
      
      return { type: ValueType.String, value: buf } as StringValue;
   }
} as NativeFunValue })

str_lib.set("split", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
   type: ValueType.Native,
   body: async (args: Value[], _scope: Scope, _i: Interpreter) => {
      if (args.length != 2 || args[0].type != ValueType.String || args[1].type != ValueType.String) {
         throw 'invalid Std::String::split() function signature';
      }
      
      return { type: ValueType.Array, val: (args[0] as StringValue).value.split((args[1] as StringValue).value).map(s => ({ type: ValueType.String, value: s } as StringValue)) } as ArrayValue;
   }
} as NativeFunValue })

str_lib.set("len", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
   type: ValueType.Native,
   body: async (args: Value[], _scope: Scope, _i: Interpreter) => {
      if (args.length != 1 || args[0].type != ValueType.String) {
         throw `invalid Std::String::len() function signature`;
      }
      
      return { type: ValueType.Number, value: (args[0] as StringValue).value.length } as NumberValue;
   }
} as NativeFunValue })

str_lib.set("codeAt", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
   type: ValueType.Native,
   body: async (args: Value[], _scope: Scope, _i: Interpreter) => {
      if (args.length != 2 || args[0].type != ValueType.String || args[1].type != ValueType.Number) {
         throw `invalid Std::String::codeAt() function signature`;
      }
      
      return { type: ValueType.Number, value: (args[0] as StringValue).value.charCodeAt((args[1] as NumberValue).value) } as NumberValue;
   }
} as NativeFunValue })

const enc = new TextEncoder();
const dec = new TextDecoder();

str_lib.set("encodeText", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
   type: ValueType.Native,
   body: async (args: Value[], _scope: Scope, _i: Interpreter) => {
      if (args.length != 1 || args[0].type != ValueType.String) {
         throw `invalid Std::String::encodeText() function signature`;
      }
      
      const val = new Map();
      val.set('Encoder', enc.encode((args[0] as StringValue).value));
      return { type: ValueType.Object, val } as ObjectValue;
   }
} as NativeFunValue })

str_lib.set("decodeText", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
   type: ValueType.Native,
   body: async (args: Value[], _scope: Scope, _i: Interpreter) => {
      if (args.length != 1 || args[0].type != ValueType.Object || !(args[0] as ObjectValue).val.has('Encoder')) {
         throw `invalid Std::String::encodeText() function signature`;
      }

      return { 
         type: ValueType.String, 
         value: dec.decode(
            (args[0] as ObjectValue).val.get('Encoder') as unknown as Uint8Array<ArrayBufferLike>
         ) 
      } as StringValue;
   }
} as NativeFunValue })

str_lib.set("isEncoded", { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
   type: ValueType.Native,
   body: async (args: Value[], _scope: Scope, _i: Interpreter) => {
      if (args.length != 1) {
         throw `invalid Std::String::isEncoded function signature`;
      }
      return { 
         type: ValueType.String, 
         value: args[0].type == ValueType.Object && (args[0] as ObjectValue).val.has('Encoder'),
      } as BoolValue;
   }
} as NativeFunValue })