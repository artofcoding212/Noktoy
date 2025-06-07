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