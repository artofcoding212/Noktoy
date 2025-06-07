// deno-lint-ignore-file require-await
import { Interpreter, Scope, Variable } from "../backend/interpreter.ts";
import { AnyType, EntityRawType, LooseRecordType, satisfiesType, StringType, Type, TypeType } from "../shared/types.ts";
import { NativeFunValue, NumberValue, StaticStructValue, StaticTagValue, ArrayValue, StructValue, ObjectValue, TagValue, StringValue, Value, ValueType, BoolValue, PointerValue, NoneValue, FunValue } from "../shared/values.ts";

export const ffi_lib: Map<string, Variable> = new Map();

/*

Std::FFI
|> Standard library entry for interacting with DLLs.

Contributors
* artofcoding212 (Github & Discord)

Documentation
* loadScriptib(path: String) <String: Any>
   | Loads a TypeScript/JavaScript file's exports and represents them in a Noktoy-supported format.
* formatLib(lib: String) String 
   | Formats the given library into the correct one for the OS.
* loadLib(lib: String, bindings: <String: { params: CType[], result: CType }>)
   | Loads the given library with the given functions. Each function is specified with their
   | input parameter types and an output result type.
   | The functions generated take in parameters of C values and outputs a C value.
* CType: Enum
   | A type of C value.
   Entries:
    u8
    u16
    u32
    u64
    i8
    i16
    i32
    i64
    f32
    f64
    None
    Buffer
    Bool
    Pointer
    Struct(<String: CType>)
* CValue: Struct
   | A structure representing a C value.
   Fields:
    type CType
   Static methods:
    u32(n: Number) CValue
      | Returns a CValue of type CType::u32
    i32(n: Number) CValue
      | Returns a CValue of type CType:i32
   Methods:
    ptrCString(self: CValue) String
      | Treats the current CValue as a CType::Pointer that points to a C string (char*) and reads it out
      | into a String.
    number(self: CValue) Number
      | Assumes the current CValue is one of the number types, converts it into a regular Noktoy number.

*/

// deno-lint-ignore no-explicit-any
export function noktoyValueToTsValue(v: Value, s: Scope, i: Interpreter): any {
    switch (v.type) {
        case ValueType.Number:
            return (v as NumberValue).value;
        case ValueType.String:
            return (v as StringValue).value;
        case ValueType.None:
            return null;
        case ValueType.Bool:
            return (v as BoolValue).value;
        case ValueType.Fun:
            // deno-lint-ignore no-explicit-any
            return async (...args: any[]): Promise<any> => {
                return await i.runFun(v as FunValue, args.map(v => tsValueNoktoyValue(v, s, i)), s);
            }
        case ValueType.Array:
            return (v as ArrayValue).val.map((val) => noktoyValueToTsValue(val, s, i));
        case ValueType.Object: {
            // deno-lint-ignore no-explicit-any
            const a: Record<any, any> = {}
            for (const [k,val] of (v as ObjectValue).val) {
                a[noktoyValueToTsValue(JSON.parse(k), s, i)] = noktoyValueToTsValue(val, s, i);
            }
            return a;
        }
        case ValueType.Pointer:
            return noktoyValueToTsValue(i.stack[(v as PointerValue).points], s, i);
        case ValueType.StaticTag:
        case ValueType.Tag:
        case ValueType.StaticStruct:
        case ValueType.Struct:
        case ValueType.Namespace:
        case ValueType.Native:
        case ValueType.NativeMacro:
        default:
            return undefined;
    }
}

// deno-lint-ignore no-explicit-any
export function tsValueNoktoyValue(v: any, s: Scope, i: Interpreter): Value {
    switch (typeof v) {
        case "string":
            return { type: ValueType.String, value: v } as StringValue;
        case "number":
        case "bigint":
            return { type: ValueType.Number, value: Number(v) } as NumberValue;
        case "boolean":
            return { type: ValueType.Bool, value: v } as BoolValue;
        case "object": {
            if (v instanceof Map) {
                const m = new Map();
                for (const [k,val] of v) {
                    m.set(JSON.stringify(tsValueNoktoyValue(k, s, i)), tsValueNoktoyValue(val, s, i));
                }
                return { type: ValueType.Object, val: m } as ObjectValue;
            }
            if (v instanceof Array) {
                const arr = []
                for (const e of v) {
                    arr.push(tsValueNoktoyValue(e, s, i));
                }
                return { type: ValueType.Array, val: arr } as ArrayValue;
            }
            if (Object.prototype.toString.call(v) === '[object Object]') {
                const m = new Map();
                for (const k of Object.keys(v)) {
                    m.set(JSON.stringify(tsValueNoktoyValue(k, s, i)), tsValueNoktoyValue(v[k], s, i));
                }
                return { type: ValueType.Object, val: m } as ObjectValue;
            }
            if (v instanceof Error) {
                return { type: ValueType.String, value: (v as Error).message } as StringValue;
            }
            return { type: ValueType.None } as NoneValue;
        }
        case "function":
            return {
                type: ValueType.Native,
                body: async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
                    return tsValueNoktoyValue(await v(...args.map((v) => noktoyValueToTsValue(v, s, i))), _scope, _i);
                }
            } as NativeFunValue;
        default:
            return { type: ValueType.None } as NoneValue;
    }
}

ffi_lib.set('loadScriptLib', {mutable:false,type:{type:TypeType.Any}as AnyType,value: {type:ValueType.Native, body:
    async (args: Value[], s: Scope, i: Interpreter): Promise<Value> => {
        if (args.length != 1 || args[0].type != ValueType.String) {
            throw 'invalid function signature to Std::FFI::loadScriptLib';
        }

        const mod = await import('file:///'+(args[0] as StringValue).value);
        const map = new Map();

        for (const k of Object.keys(mod)) {
            map.set(
                JSON.stringify({type:ValueType.String,value:k} as StringValue),
                tsValueNoktoyValue(mod[k], s, i)
            );
        }

        return { type: ValueType.Object, val: map } as ObjectValue;
    }
} as NativeFunValue});

const ctype = {
    type: ValueType.StaticTag,
    tagged: new Map(),
    nontagged: new Map(),
} as StaticTagValue;
ctype.nontagged.set('u8', undefined);
ctype.nontagged.set('i8', undefined);
ctype.nontagged.set('u16', undefined);
ctype.nontagged.set('i16', undefined);
ctype.nontagged.set('u32', undefined);
ctype.nontagged.set('i32', undefined);
ctype.nontagged.set('u64', undefined);
ctype.nontagged.set('i64', undefined);
ctype.nontagged.set('f32', undefined);
ctype.nontagged.set('f64', undefined);
ctype.nontagged.set('Pointer', undefined);
ctype.nontagged.set('None', undefined);
ctype.nontagged.set('Buffer', undefined);
ctype.nontagged.set('Bool', undefined);
ctype.tagged.set('Struct', {
    type: TypeType.LooseRecord, 
    key: { type: TypeType.String } as StringType,
    value: { type: TypeType.EntityRaw, val: ctype } as EntityRawType,
} as LooseRecordType);

const cvalue = {
    type: ValueType.StaticStruct,
    staticFields: new Map(),
    staticFuns: new Map(),
    funs: new Map(),
    fields: new Map(),
} as StaticStructValue;

interface NumberCValue extends StructValue {
    n: number;
}

interface PointerCValue extends StructValue {
    ptr: Deno.PointerValue<unknown>;
}

cvalue.fields.set('type', { type: TypeType.EntityRaw, val: ctype } as EntityRawType);
cvalue.staticFuns.set('buf', {
    type: ValueType.Native,
    body: async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (args.length != 1 || args[0].type != ValueType.Number) {
            throw `invalid function signature for Std::FFI::CValue::ptrOfVar static function`;
        }

        const buffer = new ArrayBuffer((args[0] as NumberValue).value);

        const f = new Map();
        f.set('type', [
            { type: ValueType.Tag, name: 'Pointer', parent: ctype, tagged: undefined } as TagValue,
            { type: TypeType.EntityRaw, val: cvalue } as EntityRawType,
        ]);

        return {
            type: ValueType.Struct,
            parent: cvalue,
            fields: f,
            ptr: Deno.UnsafePointer.of(buffer),
            size: (args[0] as NumberValue).value,
        } as PointerCValue;
    },
} as NativeFunValue);
{
    const fn = (name: string) => {
        return {
            type: ValueType.Native,
            body: async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
                if (
                    (args.length > 2 || args.length<1) ||
                    (args.length == 2 ? args[1].type != ValueType.Number : false) ||
                    args[0].type != ValueType.Struct ||
                    JSON.stringify((args[0] as StructValue).parent) != JSON.stringify(cvalue) ||
                    !('ptr' in (args[0] as StructValue))
                ) {
                    throw `invalid function signature for Std::FFI::CValue::ptr${name.toUpperCase()} function`;
                }
                const ptr = (args[0] as PointerCValue).ptr;
                const view = new Deno.UnsafePointerView(ptr as NonNullable<Deno.PointerValue<unknown>>);
                let value: number;
                const offset: number|undefined = args.length == 2 ? (args[1] as NumberValue).value : undefined;
                switch (name) {
                    case "u8":
                        value = view.getUint8(offset);
                        break;
                    case "i8":
                        value = view.getInt8(offset);
                        break;
                    case "u16":
                        value = view.getUint16(offset);
                        break;
                    case "i16":
                        value = view.getInt16(offset);
                        break;
                    case "u32":
                        value = view.getUint32(offset);
                        break;
                    case "i32":
                        value = view.getInt32(offset);
                        break;
                    case "f32":
                        value = view.getFloat32(offset);
                        break;
                    case "f64":
                        value = view.getFloat64(offset);
                        break;
                    default:
                        value = 0;
                        break;
                }
                return {
                    type: ValueType.Number,
                    value,
                } as NumberValue;
            }
        }
    }
    cvalue.funs.set('ptrU8', fn('u8'));
    cvalue.funs.set('ptrU16', fn('u16'));
    cvalue.funs.set('ptrU32', fn('u32'));
    cvalue.funs.set('ptrU64', fn('u64'));
    cvalue.funs.set('ptrI8', fn('i8'));
    cvalue.funs.set('ptrI16', fn('i16'));
    cvalue.funs.set('ptrI32', fn('i32'));
    cvalue.funs.set('ptrI64', fn('i64'));
    cvalue.funs.set('ptrF32', fn('f32'));
    cvalue.funs.set('ptrF64', fn('f64'));
}
cvalue.funs.set('asArrayBuf', {
    type: ValueType.Native,
    body: async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (
            args.length != 1 ||
            JSON.stringify((args[0] as StructValue).parent) != JSON.stringify(cvalue) ||
            !('ptr' in (args[0] as StructValue)) ||
            !('size' in (args[0] as StructValue))
        ) {
            throw `invalid function signature for Std::FFI::CValue::asArrayBuf() function`;
        }

        const n: StructValue = {...args[0] as StructValue};
        (n as StructValue&{isArrBuf: boolean}).isArrBuf = true;
        return n;
    }
});
{
    const fn = (name: string) => {
        return {
            type: ValueType.Native,
            body: async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
                if (
                    args.length != 3 ||
                    args[1].type != ValueType.Number ||
                    args[2].type != ValueType.Number ||
                    args[0].type != ValueType.Struct ||
                    JSON.stringify((args[0] as StructValue).parent) != JSON.stringify(cvalue) ||
                    !('ptr' in (args[0] as StructValue)) ||
                    !('size' in (args[0] as StructValue))
                ) {
                    throw `invalid function signature for Std::FFI::CValue::setBuf${name.toUpperCase()} function`;
                }

                const ptr = (args[0] as PointerCValue).ptr;
                const dataView = new DataView(new Deno.UnsafePointerView(ptr as Deno.PointerObject).getArrayBuffer((args[0] as StructValue&{size: number}).size));
                const offset = (args[1] as NumberValue).value;
                const value = (args[2] as NumberValue).value;
                
                switch (name) {
                    case "u8":
                        dataView.setUint8(offset, value);
                        break;
                    case "i8":
                        dataView.setInt8(offset, value);
                        break;
                    case "u16":
                        dataView.setUint16(offset, value, true);
                        break;
                    case "i16":
                        dataView.setInt16(offset, value, true);
                        break;
                    case "u32":
                        dataView.setUint32(offset, value, true);
                        break;
                    case "i32":
                        dataView.setInt32(offset, value, true);
                        break;
                    case "f32":
                        dataView.setFloat32(offset, value, true);
                        break;
                    case "f64":
                        dataView.setFloat64(offset, value, true);
                        break;
                }
                return { type: ValueType.None } as NoneValue;
            }
        }
    }
    cvalue.funs.set('setBufU8', fn('u8'));
    cvalue.funs.set('setBufU16', fn('u16'));
    cvalue.funs.set('setBufU32', fn('u32'));
    cvalue.funs.set('setBufU64', fn('u64'));
    cvalue.funs.set('setBufI8', fn('i8'));
    cvalue.funs.set('setBufI16', fn('i16'));
    cvalue.funs.set('setBufI32', fn('i32'));
    cvalue.funs.set('setBufI64', fn('i64'));
    cvalue.funs.set('setBufF32', fn('f32'));
    cvalue.funs.set('setBufF64', fn('f64'));
}
{
    const fn = (name: string) => {
        return {
            type: ValueType.Native,
            body: async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
                if (args.length != 1 || args[0].type != ValueType.Number) {
                    throw `invalid function signature for Std::FFI::CValue::${name} static function`;
                }
                const f = new Map();
                f.set('type', [
                    { type: ValueType.Tag, name, parent: ctype, tagged: undefined } as TagValue,
                    { type: TypeType.EntityRaw, val: cvalue } as EntityRawType,
                ]);
                return { 
                    n: (args[0] as NumberValue).value,
                    type: ValueType.Struct,
                    fields: f,
                    parent: cvalue,
                } as NumberCValue;
            },
        } as NativeFunValue;
    }
    // Add static functions for all numeric types
    cvalue.staticFuns.set('u8', fn('u8'));
    cvalue.staticFuns.set('i8', fn('i8'));
    cvalue.staticFuns.set('u16', fn('u16'));
    cvalue.staticFuns.set('i16', fn('i16'));
    cvalue.staticFuns.set('u32', fn('u32'));
    cvalue.staticFuns.set('i32', fn('i32'));
    cvalue.staticFuns.set('u64', fn('u64'));
    cvalue.staticFuns.set('i64', fn('i64'));
    cvalue.staticFuns.set('f32', fn('f32'));
    cvalue.staticFuns.set('f64', fn('f64'));
}
cvalue.funs.set('number', {
    type: ValueType.Native,
    body: async (args: Value[], scope: Scope, i: Interpreter): Promise<Value> => {
        if (
            args.length != 1 || 
            !satisfiesType(args[0], { type: TypeType.EntityRaw, val: cvalue } as EntityRawType, i, scope) ||
            !('n' in (args[0] as StructValue))
        ) {
            throw `invalid function signature for Std::FFI::CValue::number() function`;
        }
        return { 
            type: ValueType.Number,
            value: (args[0] as NumberCValue).n,
        } as NumberValue;
    },
} as NativeFunValue);
cvalue.funs.set('ptrCString', {
    type: ValueType.Native,
    body: async (args: Value[], scope: Scope, i: Interpreter): Promise<Value> => {
        if (
            args.length != 1 || 
            !satisfiesType(args[0], { type: TypeType.EntityRaw, val: cvalue } as EntityRawType, i, scope) ||
            !('ptr' in (args[0] as StructValue))
        ) {
            throw `invalid function signature for Std::FFI::CValue::ptrCString() function`;
        }
        return { 
            type: ValueType.String,
            value: Deno.UnsafePointerView.getCString((args[0] as PointerCValue).ptr!),
        } as StringValue;
    },
} as NativeFunValue);

ffi_lib.set('CValue', { mutable: false, value: cvalue, type: { type: TypeType.Any } as AnyType });
ffi_lib.set('CType', { mutable: false, value: ctype, type: { type: TypeType.Any } as AnyType });
{
    const OS_PREIFX = Deno.build.os == 'windows' ? "" : "lib";
    const OS_SUFFIX = Deno.build.os == "windows" ? ".dll" : Deno.build.os == "darwin" ? ".dylib" : ".so";
    ffi_lib.set('formatLib', { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
        type: ValueType.Native,
        body: async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
            if (args.length != 1 || args[0].type != ValueType.String) {
                throw `invalid Std::FFI::formatLib() function signature`;
            }
            return {
                type: ValueType.String,
                value: `${OS_PREIFX}${(args[0] as StringValue).value}${OS_SUFFIX}`,
            } as StringValue;
        },
    } as NativeFunValue });
}

type CType = number | bigint | boolean | Deno.PointerValue<unknown> | BufferSource;
type CFun = (...args: CType[]) => CType;

// deno-lint-ignore no-explicit-any
export function valueToLiteral(value: Value): any { 
    // Handle CValue structs first
    if (value.type === ValueType.Struct) {
        const struct = value as StructValue;
        if (struct.parent === cvalue) {
            const typeTag = (struct.fields.get('type') as [Value,Type])[0] as TagValue;
            switch (typeTag.name) {
                case 'u32':
                case 'u64':
                case 'u8':
                case 'u16':
                case 'i8':
                case 'i16':
                case 'f32':
                case 'f64':
                case 'i32':
                case 'i64':
                case 'Bool':
                    return (struct as NumberCValue).n;
                case 'Pointer':
                case 'Buffer':
                    if ('isArrBuf' in struct && 'ptr' in struct && 'size' in struct && struct.isArrBuf == true) {
                        return new Deno.UnsafePointerView((struct as PointerCValue).ptr as Deno.PointerObject).getArrayBuffer((struct as StructValue&{size: number}).size);
                    }
                    return (struct as PointerCValue).ptr;
                case 'None':
                    return null;
            }
        }
    }

    // Handle regular Noktoy values
    switch (value.type) {
        case ValueType.Number:
            return (value as NumberValue).value;
        case ValueType.String:
            return (value as StringValue).value;
        case ValueType.Bool:
            return (value as BoolValue).value;
        case ValueType.None:
            return null;
        case ValueType.Array:
            return (value as ArrayValue).val.map(v => valueToLiteral(v));
        case ValueType.Object: {
            // Special case for TextEncoder output
            if ((value as ObjectValue).val.has('Encoder')) {
                return (value as ObjectValue).val.get('Encoder') as unknown as Uint8Array;
            }
            const result: Record<string, unknown> = {};
            for (const [k, v] of (value as ObjectValue).val) {
                const key = JSON.parse(k);
                result[valueToLiteral(key as Value)] = valueToLiteral(v);
            }
            return result;
        }
        case ValueType.Pointer:
            return (value as PointerValue).points;
        default:
            return undefined;
    }
}

function cTypeToCValue(val: CType): StructValue {
    if (typeof val === 'number') {
        if (val >= 0) {
            const f = new Map();
            f.set('type', [
                { type: ValueType.Tag, name: 'u32', parent: ctype, tagged: undefined } as TagValue,
                { type: TypeType.EntityRaw, val: ctype } as EntityRawType,
            ]);
            return { 
                n: val,
                type: ValueType.Struct,
                fields: f,
                parent: cvalue,
            } as NumberCValue;
        }
        const f = new Map();
        f.set('type', [
            { type: ValueType.Tag, name: 'i32', parent: ctype, tagged: undefined } as TagValue,
            { type: TypeType.EntityRaw, val: ctype } as EntityRawType
        ]);
        return { 
            n: val,
            type: ValueType.Struct,
            fields: f,
            parent: cvalue,
        } as NumberCValue;
    }

    if (typeof val === 'boolean') {
        const f = new Map();
        f.set('type', [
            { type: ValueType.Tag, name: 'Bool', parent: ctype, tagged: undefined } as TagValue,
            { type: TypeType.EntityRaw, val: ctype } as EntityRawType,
        ]);
        return { 
            n: val ? 1 : 0,
            type: ValueType.Struct,
            fields: f,
            parent: cvalue,
        } as NumberCValue;
    }

    if (val === null || val == undefined) {
        const f = new Map();
        f.set('type', [
            { type: ValueType.Tag, name: 'None', parent: ctype, tagged: undefined } as TagValue,
            { type: TypeType.EntityRaw, val: ctype } as EntityRawType,
        ]);
        return { 
            type: ValueType.Struct,
            fields: f,
            parent: cvalue,
        } as StructValue;
    }

    // Handle pointers and buffers
    const f = new Map();
    if (val instanceof Uint8Array) {
        f.set('type', [
            { type: ValueType.Tag, name: 'Buffer', parent: ctype, tagged: undefined } as TagValue,
            { type: TypeType.EntityRaw, val: ctype } as EntityRawType,
        ]);
        return { 
            ptr: Deno.UnsafePointer.of(val),
            type: ValueType.Struct,
            fields: f,
            parent: cvalue,
        } as PointerCValue;
    }

    if (val instanceof ArrayBuffer) {
        f.set('type', [
            { type: ValueType.Tag, name: 'Buffer', parent: ctype, tagged: undefined } as TagValue,
            { type: TypeType.EntityRaw, val: ctype } as EntityRawType,
        ]);
        return { 
            ptr: Deno.UnsafePointer.of(new Uint8Array(val)),
            type: ValueType.Struct,
            fields: f,
            parent: cvalue,
        } as PointerCValue;
    }
    
    f.set('type', [
        { type: ValueType.Tag, name: 'Pointer', parent: ctype, tagged: undefined } as TagValue,
        { type: TypeType.EntityRaw, val: ctype } as EntityRawType,
    ]);
    return { 
        ptr: val as Deno.PointerValue<unknown>,
        type: ValueType.Struct,
        fields: f,
        parent: cvalue,
    } as PointerCValue;
}

{
    const CTypeLu: Record<string, string> = {
        'Pointer': 'pointer',
        'u8': 'u8',
        'i8': 'i8', 
        'u16': 'u16',
        'i16': 'i16',
        'u32': 'u32',
        'i32': 'i32',
        'u64': 'u64',
        'i64': 'i64',
        'f32': 'f32',
        'f64': 'f64',
        'Bool': 'u8',
        'None': 'void',
        'Buffer': 'buffer',
    };

    ffi_lib.set('loadLib', { mutable: false, type: { type: TypeType.Any } as AnyType, value: {
        type: ValueType.Native,
        body: async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
            if (args.length != 2 || args[0].type != ValueType.String || args[1].type != ValueType.Object) {
                throw `invalid Std::FFI::loadLib() function signature`;
            }

            const lib: Deno.ForeignLibraryInterface = {};
            const symbols: string[] = [];
            const mapT = (t: TagValue): Deno.NativeType => {
                if (t.name == 'Struct') {
                    const fields: Deno.NativeType[] = [];
                    for (const [_k,v] of ((t as TagValue).tagged as ObjectValue).val) {
                        fields.push(mapT(v as TagValue));
                    }
                    return { struct: fields };
                }
                return CTypeLu[(t as TagValue).name] as Deno.NativeType;
            }

            for (const [k,v] of (args[1] as ObjectValue).val) {
                if (
                    v.type != ValueType.Object || 
                    !((v as ObjectValue).val.has('{"type":2,"value":"params"}')) || 
                    !((v as ObjectValue).val.has('{"type":2,"value":"result"}')) ||
                    (v as ObjectValue).val.get('{"type":2,"value":"params"}')?.type != ValueType.Array ||
                    (v as ObjectValue).val.get('{"type":2,"value":"result"}')?.type != ValueType.Tag ||
                    JSON.stringify(((v as ObjectValue).val.get('{"type":2,"value":"result"}') as TagValue).parent) != JSON.stringify(ctype)
                ) {
                    throw `invalid Std::FFI::loadLib() function signature`;
                }
                const key = (JSON.parse(k) as StringValue).value;
                symbols.push(key);
                const parameters = [];
                for (const x of ((v as ObjectValue).val.get('{"type":2,"value":"params"}') as ArrayValue).val) {
                    if (x.type != ValueType.Tag || JSON.stringify((x as TagValue).parent) != JSON.stringify(ctype)) {
                        throw `invalid Std::FFI::loadLib() function signature`;
                    }
                    parameters.push(mapT(x as TagValue));
                }

                lib[key] = {
                    parameters: parameters as readonly Deno.NativeType[],
                    result: mapT((v as ObjectValue).val.get('{"type":2,"value":"result"}') as TagValue) as Deno.NativeType,
                };
            }

            const dlLib = Deno.dlopen((args[0] as StringValue).value, lib);
            const result: Map<string, Value> = new Map();

            for (const symbol of symbols) {
                result.set(JSON.stringify({ type: ValueType.String, value: symbol } as StringValue), {
                    type: ValueType.Native,
                    body: async (fArgs: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
                        const nativeArgs = fArgs.map(arg => valueToLiteral(arg));
                        const ret = (dlLib.symbols[symbol] as CFun)(...nativeArgs);
                        return cTypeToCValue(ret);
                    }
                } as NativeFunValue);
            }

            return {
                type: ValueType.Object,
                val: result,
            } as ObjectValue;
        },
    } as NativeFunValue });
}