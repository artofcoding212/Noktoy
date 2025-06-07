import { Interpreter, Scope, Variable } from "../backend/interpreter.ts";
import { BoolValue, NumberValue, StringValue, Value, ValueType, FunValue, ArrayValue, ObjectValue, PointerValue, StructValue, StaticStructValue, TagValue, StaticTagValue } from "./values.ts";

export enum TypeType {
    //? literals
    Number, // Number, or can be a plain number
    String, // String, or can be a plain string
    Bool, // Bool, or can be true/false literals
    None, // None or none
    Any, // any

    //? typed types
    Or,     // T|T
    Array,  // T[]
    Tuple,  // [T,T,T,...]
    Pointer, // &T
    LooseRecord, // <T: T>
    Entity, // name
    EntityRaw, // [Value]
    Fun, // fun(param: Type) Type
}

export interface Type {
    type: TypeType;
}

export interface AnyType extends Type {}

export interface PointerType extends Type {
    t: Type;
}

export interface FunType extends Type {
    params: [string, Type, boolean][];
    ret: Type;
}

export interface NumberType extends Type {
    num?: number;
}

export interface StringType extends Type {
    str?: string;
}

export interface BoolType extends Type {
    bool?: boolean;
}

export interface NoneType extends Type {}

export interface OrType extends Type {
    a: Type;
    b: Type;
}

export interface ArrayType extends Type {
    t: Type;
}

export interface TupleType extends Type {
    a: Type[];
}

export interface LooseRecordType extends Type {
    key: Type;
    value: Type;
}

export interface EntityType extends Type {
    name: string;
}

export interface EntityRawType extends Type {
    val: Value;
}

//! HACK
// I don't know why importing scopeGet from the interpreter file creates a bunch of errors, but it does
// It's likely due to recursive imports, so defining it here fixes it :)
function scopeGet(scope: Scope, name: string): [Variable|undefined, Scope] {
    const v = scope.members.get(name);
    if (v==undefined) {
        return scope.parent == undefined ? [undefined, scope] : scopeGet(scope.parent, name);
    } 
    return [v, scope];
}

function entityRawSatisfiesT(e: Value, value: Value, i: Interpreter, s: Scope): boolean {
    switch (e.type) {
        case ValueType.StaticStruct: {
            if (value.type != ValueType.Struct) {
                return false;
            }
            return JSON.stringify((value as StructValue).parent) == JSON.stringify(e as StaticStructValue);
        }
        case ValueType.StaticTag: {
            if (value.type != ValueType.Tag || JSON.stringify((value as TagValue).parent) != JSON.stringify(e)) {
                return false;
            }
            if ((value as TagValue).tagged != undefined) {
                return (e as StaticTagValue).tagged.has((value as TagValue).name) &&
                    satisfiesType(
                        (value as TagValue).tagged as Value, 
                        (e as StaticTagValue).tagged.get((value as TagValue).name) as Type,
                    i, s);
            }
            return (e as StaticTagValue).nontagged.has((value as TagValue).name);
        }
        default:
            return false;
    }
}

export function satisfiesType(value: Value, t: Type, i: Interpreter, s: Scope): boolean {
    switch (t.type) {
        case TypeType.Any:
            return true;
        case TypeType.Number:
            return (t as NumberType).num == undefined ? (value.type == ValueType.Number) : (value.type == ValueType.Number && (value as NumberValue).value == (t as NumberType).num);
        case TypeType.String:
            return (t as StringType).str == undefined ? (value.type == ValueType.String) : (value.type == ValueType.String && (value as StringValue).value == (t as StringType).str);
        case TypeType.Bool:
            return (t as BoolType).bool == undefined ? (value.type == ValueType.Bool) : (value.type == ValueType.Bool && (value as BoolValue).value == (t as BoolType).bool);
        case TypeType.None:
            return value.type == ValueType.None;
        case TypeType.Or: 
            return satisfiesType(value, (t as OrType).a, i, s)||satisfiesType(value, (t as OrType).b, i, s);
        case TypeType.Fun:
            return value.type == ValueType.Fun &&
                JSON.stringify((value as FunValue).t.ret) == JSON.stringify((t as FunType).ret) &&
                (value as FunValue).t.params.length == (t as FunType).params.length;
        case TypeType.Entity: {
            const [e] = scopeGet(s, (t as EntityType).name);
            if (e==undefined) {
                return false;
            }
            return entityRawSatisfiesT(e.value, value, i, s);
        }
        case TypeType.EntityRaw: {
            return entityRawSatisfiesT((t as EntityRawType).val, value, i, s); 
        }
        case TypeType.Pointer: {
            if (value.type != ValueType.Pointer || !('type' in (i.stack[(value as PointerValue).points] ?? {}))) {
                return false;
            }
            if ((value as PointerValue).t == undefined) {
                if (!satisfiesType(i.stack[(value as PointerValue).points], (t as PointerType).t, i, s)) {
                    return false;
                }
                (value as PointerValue).t = (t as PointerType).t;
                return true;
            }

            return JSON.stringify((value as PointerValue).t) == JSON.stringify((t as PointerType).t);
        }
        case TypeType.Tuple: {
            const tup = t as TupleType;
            if (value.type != ValueType.Array || (value as ArrayValue).val.length != tup.a.length) {
                return false;
            }
            
            if ((value as ArrayValue).t != undefined && (value as ArrayValue).t == tup) {
                return true;
            }

            for (let idx = 0; idx < tup.a.length; idx++) {
                if (!satisfiesType((value as ArrayValue).val[idx], tup.a[idx], i, s)) {
                    return false;
                }
            }

            if ((value as ArrayValue).t == undefined) {
                (value as ArrayValue).t = tup;
            }

            return true;
        }
        case TypeType.Array: {
            const arr = t as ArrayType;
            if (value.type != ValueType.Array) {
                return false;
            }

            if ((value as ArrayValue).t != undefined && JSON.stringify((value as ArrayValue).t) == JSON.stringify(arr)) {
                return true;
            }

            for (const v of (value as ArrayValue).val) {
                if (!satisfiesType(v, arr.t, i, s)) {
                    return false;
                }
            }

            if ((value as ArrayValue).t == undefined) {
                (value as ArrayValue).t = arr;
            }
            
            return true;
        }
        case TypeType.LooseRecord: {
            if (value.type != ValueType.Object) {
                return false;
            }
            const rec = t as LooseRecordType;
            if ((value as ObjectValue).t != undefined && JSON.stringify((value as ObjectValue).t) == JSON.stringify(rec)) {
                return true;
            }
            for (const [k,v] of (value as ObjectValue).val) {
                if (
                    !satisfiesType(JSON.parse(k) as Value, rec.key, i, s)
                    || !satisfiesType(v, rec.value, i, s)
                ) {
                    return false;
                }
            }

            (value as ObjectValue).t = rec;
            return true;
        }
        default:
            return false;
    }
}

export function tostringType(t: Type): string {
    switch (t.type) {
        case TypeType.Number:
            return String((t as NumberType).num || "Number");
        case TypeType.String:
            return (t as StringType).str == undefined ? "String" : '"'+(t as StringType).str+'"';
        case TypeType.Bool:
            return (t as BoolType).bool == undefined ? "Bool" : ((t as BoolType).bool ? "true" : "false");
        case TypeType.None:
            return "None";
        case TypeType.Or:
            return tostringType((t as OrType).a)+' | '+tostringType((t as OrType).b);
        case TypeType.Array:
            return `${tostringType((t as ArrayType).t)}[]`;
        case TypeType.Tuple: {
            let buf = '['
            for (const x of (t as TupleType).a) {
                buf = `${buf}${tostringType(x)}, `;
            }
            return buf+']';
        }
        case TypeType.LooseRecord:
            return `<${tostringType((t as LooseRecordType).key)}: ${tostringType((t as LooseRecordType).value)}>`
        case TypeType.Entity:
            return (t as EntityType).name;
        case TypeType.Fun: {
            const f = t as FunType;
            let str = 'fun(';
            for (const param of f.params) {
                str = `${str}${param[0]}: ${tostringType(param[1])}, `;
            }
            return `${str}) ${tostringType(f.ret)}`;
        }
        case TypeType.Pointer:
            return "&"+tostringType((t as PointerType).t);
        case TypeType.EntityRaw:
        case TypeType.Any:
        default:
            return "Any";
    }
}