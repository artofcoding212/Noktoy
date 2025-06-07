import { Interpreter, Scope } from "../backend/interpreter.ts";
import { Ast } from "../frontend/ast.ts";
import { ArrayType, FunType, LooseRecordType, tostringType, TupleType, Type } from "./types.ts";

export enum ValueType {
    Namespace,
    Number,
    String,
    None,
    Bool,
    Fun,
    Native,
    NativeMacro,
    Array,
    Object,
    Pointer,
    StaticTag,
    Tag,
    StaticStruct,
    Struct,
}

export interface Value {
    type: ValueType;
}

export interface StaticTagValue extends Value {
    tagged: Map<string, Type>;
    nontagged: Map<string, undefined>;
}

export interface TagValue extends Value {
    name: string;
    parent: StaticTagValue;
    tagged?: Value;
}

export interface StructValue extends Value {
    //? funs are stored in parent
    fields: Map<string, [Value, Type]>;
    parent: StaticStructValue;
}

export interface StaticStructValue extends Value {
    staticFields: Map<string, [Type, Value]>;
    staticFuns: Map<string, FunValue|NativeFunValue>;
    funs: Map<string, FunValue|NativeFunValue>;
    fields: Map<string, Type>;
}

export interface PointerValue extends Value {
    points: number;
    t?: Type;
}

export interface NamespaceValue extends Value {
    scope: Scope;
}

export interface ObjectValue extends Value {
    t?: LooseRecordType;
    val: Map<string, Value>; //? JSON.stringify() the value for the key
}

export interface ArrayValue extends Value {
    t?: TupleType|ArrayType;
    val: Value[];
}

export interface FunValue extends Value {
    t: FunType;
    name?: string;
    body: Ast[];
    scope: Scope;
    file: string;
}

export type NativeFun = (args: Value[], scope: Scope, i: Interpreter) => Promise<Value>
export interface NativeFunValue extends Value {
    body: NativeFun;
}

export type NativeMacro = (args: Ast[], scope: Scope, i: Interpreter) => Promise<Value>;
export interface NativeMacroValue extends Value {
    body: NativeMacro;
}

export interface NumberValue extends Value {
    value: number;
}

export interface StringValue extends Value {
    value: string;
}

export interface BoolValue extends Value {
    value: boolean;
}

export interface NoneValue extends Value {}

export function falsey(r: Value): boolean {
    return r.type == ValueType.None || (r.type == ValueType.Bool && !(r as BoolValue).value);
}

export function tostring(value: Value, i: Interpreter): string {
    switch (value.type) {
        case ValueType.Number:
            return String((value as NumberValue).value);
        case ValueType.String:
            return (value as StringValue).value;
        case ValueType.Bool:
            return (value as BoolValue).value ? "true" : "false";
        case ValueType.Fun:
            return tostringType((value as FunValue).t);
        case ValueType.Namespace: {
            let str = 'Namespace { '
            for (const [k,v] of (value as NamespaceValue).scope.members) {
                str = str+`${k}: ${tostring(v.value, i)}, `;
            }
            return str+'}';
        }
        case ValueType.Array: {
            let str = '[';
            for (const v of (value as ArrayValue).val) {
                str = str+`${tostring(v, i)}, `;
            }
            return str+']';
        }
        case ValueType.Native:
            return 'Native';
        case ValueType.Object: {
            let str = '{';
            for (const [k,v] of (value as ObjectValue).val) {
                str = str+`${tostring(JSON.parse(k) as Value, i)} -> ${tostring(v, i)}, `;
            }
            return str+'}';
        }
        case ValueType.Pointer:
            return '&'+tostring(i.stack[(value as PointerValue).points], i)+'(at '+(value as PointerValue).points+')';
        case ValueType.StaticStruct:
            return 'Struct'; 
        case ValueType.Tag:
            return (value as TagValue).name + ((value as TagValue).tagged ? `(${tostring((value as TagValue).tagged as Value, i)})` : '');
        case ValueType.StaticTag:
        case ValueType.Struct:
        case ValueType.None:
        default:
            return 'none';
    }
}
