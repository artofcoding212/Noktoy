// deno-lint-ignore-file
import { Interpreter, Scope, Variable } from "../backend/interpreter.ts";
import { ArrayNode, Ast, AstType, BinaryNode, BoolNode, CallNode, CatchNode, DoNode, ErrNode, ExtNode, ForOfNode, FunDeclNode, IdNode, IfNode, MatchNode, MemberNode, NumberNode, RecordNode, ReturnNode, StringNode, StructDeclNode, TagDeclNode, UnaryNode, UseBasicNode, UseExpandNode, UseNameNode, UseNode, VarDeclNode, WhileNode } from '../frontend/ast.ts';
import { AnyType, ArrayType, BoolType, EntityRawType, FunType, LooseRecordType, NoneType, NumberType, OrType, StringType, TupleType, Type, TypeType } from "../shared/types.ts";
import { ArrayValue, BoolValue, FunValue, NativeFunValue, NativeMacroValue, NoneValue, NumberValue, ObjectValue, StaticStructValue, StaticTagValue, StringValue, StructValue, TagValue, Value, ValueType } from "../shared/values.ts";

export const noktoy_lib: Map<string, Variable> = new Map();

/*

Std::Noktoy
|> Standard library entry for interacting with the Noktoy language.

Contributors
* artofcoding212 (Github & Discord)

Documentation
* Type: Tag
   | A tag representing the type of a value.
   Entries:
    Namespace
    Number
    String
    None
    Bool
    Fun
    Native
    Array
    Object
    Pointer
    StaticTag
    Tag
    StaticStruct
    Struct
* typeof(a: Any) Type
   | Returns the type of the given value in the form of the Type tag.
* LiteralType: Tag
   | A tag representing the literal types of things. (i.e. variables, function returns, etc.)
   Entries:
    # Plain types
    Number(Number|None)
    String(String|None)
    Bool(Bool|None)
    None
    Any
    # Typed types
    Or([LiteralType, LiteralType])
    Array(LiteralType)
    Tuple(LiteralType[])
    Pointer(LiteralType)
    LooseRecord([LiteralType, LiteralType])
    Entity(String)
    EntityRaw(Any)
    Fun([[String, LiteralType, Bool][], LiteralType])
* AstStructDecl: Struct
   | A structure representing a structure declaration AST node.
   Non-static fields:
    name String
    fields <String: LiteralType>
    staticFields <String: [LiteralType, Ast]>
    funs <String: Ast>
    staticFuns <String: Ast>
* Ast: Tag
   | A tag representing an AST structure.
   Entries:
    # Expressions
    Ext(Ast)
    Do(Ast[])
    Catch([Ast, String, Ast[]])
    If([Ast, Ast[], Ast|Ast[]|None])
    Match([Ast, <Ast[]: Ast[]>, Ast[]|None])
    Binary([Ast, String, Ast])
    Unary([String, Ast])
    Number(Number)
    String(String)
    Id(String)
    Bool(Bool)
    None
    Call([Ast, Ast[]])
    Array(Ast[])
    Record([String|None, <Ast: Ast>])
    Member([Ast, String, Ast])
    # Both Statement and Expression
    FunDecl([String|None, [String, LiteralType, Bool][], LiteralType, Ast[]]) # name, params, ret, body
    # Statements
    Err(Ast)
    Continue
    Break
    ForOf([String, String, Ast, Ast[]])
    While([Ast, Ast[]])
    StructDecl(AstStructDecl)
    UseExpand([Ast, Ast[]])
    UseBasic([Ast, Ast, String|None])
    UseName([String, String|None])
    Return(Ast)
    TagDecl([String, <String: None>, <String: LiteralType>])
    VarDecl([String, Ast, LiteralType, Bool]) # name, value, type, mutable
* execAst(ast: Ast) Any
   | Executes the given AST node in the current scope, returning the result.
* gc()
   | Forces TypeScript garbage collection
[WARNING] AST nodes can include things that can massively mess up your code.
Think of it as executing normal code, but you can't directly see what the code is without going through a hassle.
* makeMacro(inner: fun (ast: Ast[]) Any) Any
   | Returns a callable macro function that, when called, executes your inner function with the given Ast
   | of each argument passed to the macro called, allowing you to manipulate it. The return value of this
   | inner function is the return value of the macro call.
   | See playground/macros.noktoy for an example.
* runningTarget(): {target: String, arch: String, os: String, vendor: String, env: String|None}
   | Returns information about the current target your code is running on.

*/

let literalTypeTag: StaticTagValue = { 
    type: ValueType.StaticTag, 
    nontagged: new Map(), 
    tagged: new Map() 
};
let astTag: StaticTagValue = { 
    type: ValueType.StaticTag, 
    nontagged: new Map(), 
    tagged: new Map() 
};

//? Type "macros"
function tor(a: Type, b: Type): Type {
    return { type: TypeType.Or, a, b } as OrType;
}

function ttup(...args: Type[]): Type {
    return { type: TypeType.Tuple, a: args } as TupleType;
}

function tent(e: Value): Type {
    return { type: TypeType.EntityRaw, val: e } as EntityRawType;
}

function tarr(a: Type): Type {
    return { type: TypeType.Array, t: a } as ArrayType;
}

function trec(a: Type, b: Type): Type {
    return { type: TypeType.LooseRecord, key: a, value: b } as LooseRecordType;
}

const tnum = { type: TypeType.Number, num: undefined } as NumberType;
const tstr = { type: TypeType.String, str: undefined } as StringType;
const tbool = { type: TypeType.Bool, bool: undefined } as BoolType;
const tnone = { type: TypeType.None } as NoneType;
//-----------

{
    const non = literalTypeTag.nontagged;
    const tag = literalTypeTag.tagged;
    // Plain types
    tag.set('Number', tor(tnum, tnone));
    tag.set('String', tor(tstr, tnone));
    tag.set('Bool', tor(tbool, tnone));
    non.set('None', undefined);
    non.set('Any', undefined);
    // Typed types
    tag.set('Or', ttup(
        { type: TypeType.EntityRaw, val: literalTypeTag } as EntityRawType,
        { type: TypeType.EntityRaw, val: literalTypeTag } as EntityRawType
    ));
    tag.set('Array', ttup(
        { type: TypeType.EntityRaw, val: literalTypeTag } as EntityRawType
    ));
    tag.set('Tuple', ttup(
        { type: TypeType.Array, t: { type: TypeType.EntityRaw, val: literalTypeTag } as EntityRawType } as ArrayType
    ));
    tag.set('Pointer', ttup(
        { type: TypeType.EntityRaw, val: literalTypeTag } as EntityRawType
    ));
    tag.set('LooseRecord', ttup(
        { type: TypeType.EntityRaw, val: literalTypeTag } as EntityRawType,
        { type: TypeType.EntityRaw, val: literalTypeTag } as EntityRawType
    ));
    tag.set('Entity', ttup(tstr));
    tag.set('EntityRaw', ttup({ type: TypeType.Any } as AnyType));
    tag.set('Fun', ttup(
        { type: TypeType.Array, t: ttup(tstr, { type: TypeType.EntityRaw, val: literalTypeTag } as EntityRawType, tbool) } as ArrayType,
        { type: TypeType.EntityRaw, val: literalTypeTag } as EntityRawType
    ));
}

const astStructDecl = {
    type: ValueType.StaticStruct,
    fields: new Map(),
    staticFields: new Map(),
    funs: new Map(),
    staticFuns: new Map(),
} as StaticStructValue;
astStructDecl.fields.set('name', tstr);
astStructDecl.fields.set('fields', trec(tstr, tent(literalTypeTag)));
astStructDecl.fields.set('staticFields', trec(tstr, ttup(tent(literalTypeTag), tent(astTag))));
astStructDecl.fields.set('funs', trec(tstr, tent(astTag)));
astStructDecl.fields.set('staticFuns', trec(tstr, tent(astTag)));

{
    const non = astTag.nontagged;
    const tag = astTag.tagged;
    // Expressions
    tag.set('Ext', tent(astTag));
    tag.set('Do', tarr(tent(astTag)));
    tag.set('Catch', ttup(tent(astTag), tstr, tarr(tent(astTag))));
    tag.set('If', ttup(tent(astTag), tarr(tent(astTag)), tor(tor(tent(astTag), tarr(tent(astTag))), tnone)));
    tag.set('Match', ttup(tent(astTag), trec(tarr(tent(astTag)), tarr(tent(astTag))), tor(tarr(tent(astTag)), tnone)));
    tag.set('Binary', ttup(tent(astTag), tstr, tent(astTag)));
    tag.set('Unary', ttup(tstr, tent(astTag)));
    tag.set('Number', tnum);
    tag.set('String', tstr);
    tag.set('Id', tstr);
    tag.set('Bool', tbool);
    tag.set('Call', ttup(tent(astTag), tarr(tent(astTag))));
    tag.set('Array', tarr(tent(astTag)));
    tag.set('Record', ttup(tor(tstr, tnone), trec(tent(astTag), tent(astTag))));
    tag.set('Member', ttup(tent(astTag), tstr, tent(astTag)));
    non.set('None', undefined);

    // Both Statement and Expression
    tag.set('FunDecl', ttup(
        tor(tstr, tnone),
        tarr(ttup(tstr, tent(literalTypeTag), tbool)),
        tent(literalTypeTag),
        tarr(tent(astTag))
    ));
    
    // Statements
    tag.set('StructDecl', tent(astStructDecl));
    tag.set('VarDecl', ttup(tstr, tent(astTag), tent(literalTypeTag), tbool));
    tag.set('TagDecl', ttup(tstr, trec(tstr, tnone), trec(tstr, tent(literalTypeTag))));
    tag.set('Return', tent(astTag));
    tag.set('UseExpand', ttup(tent(astTag), tarr(tent(astTag))));
    tag.set('UseBasic', ttup(tent(astTag), tent(astTag), tor(tstr, tnone)));
    tag.set('UseName', ttup(tstr, tor(tstr, tnone)));
    tag.set('ForOf', ttup(tstr, tstr, tent(astTag), tarr(tent(astTag))));
    tag.set('While', ttup(tent(astTag), tarr(tent(astTag))));
    tag.set('Err', tent(astTag));
    non.set('Continue', undefined);
    non.set('Break', undefined);
}

noktoy_lib.set('LiteralType', { mutable: false, type: { type: TypeType.Any } as AnyType, value: literalTypeTag });
noktoy_lib.set('Ast', { mutable: false, type: { type: TypeType.Any } as AnyType, value: astTag });
noktoy_lib.set('AstStructDecl', { mutable: false, type: { type: TypeType.Any } as AnyType, value: astStructDecl });

//! AI Warning
// I used AI to m ake this function because I didn't want to type it out-- haha
// No code quality checks were done here, I just hope it works
export function astToNoktoyValue(ast: Ast): Value {
    const makeTag = (name: string, tagged?: Value) => ({ 
        type: ValueType.Tag, 
        parent: astTag, 
        name, 
        tagged 
    } as TagValue);

    const makeArrayValue = (vals: Value[]) => ({
        type: ValueType.Array,
        val: vals
    } as ArrayValue);

    const makeRecordValue = (vals: Map<Value, Value>) => ({
        type: ValueType.Object,
        val: new Map([...vals].map(([k, v]) => [JSON.stringify(k), v]))
    } as ObjectValue);

    switch (ast.type) {
        case AstType.VarDecl: {
            const node = ast as VarDeclNode;
            return makeTag('VarDecl', makeArrayValue([
                { type: ValueType.String, value: node.name } as StringValue,
                astToNoktoyValue(node.value),
                { type: ValueType.Tag, parent: literalTypeTag, tagged: undefined, name: 'Any' } as TagValue,
                { type: ValueType.Bool, value: node.mutable } as BoolValue
            ]));
        }
        case AstType.FunDecl: {
            const node = ast as FunDeclNode;
            return makeTag('FunDecl', makeArrayValue([
                node.name ? { type: ValueType.String, value: node.name } as StringValue : { type: ValueType.None } as NoneValue,
                makeArrayValue(node.params.map(([name, type, mut]) => 
                    makeArrayValue([
                        { type: ValueType.String, value: name } as StringValue,
                        { type: ValueType.Tag, parent: literalTypeTag, tagged: undefined, name: 'Any' } as TagValue,
                        { type: ValueType.Bool, value: mut } as BoolValue
                    ])
                )),
                { type: ValueType.Tag, parent: literalTypeTag, tagged: undefined, name: 'Any' } as TagValue,
                makeArrayValue(node.body.map(b => astToNoktoyValue(b)))
            ]));
        }
        case AstType.Binary:
            return makeTag('Binary', makeArrayValue([
                astToNoktoyValue((ast as BinaryNode).a),
                { type: ValueType.String, value: (ast as BinaryNode).op } as StringValue,
                astToNoktoyValue((ast as BinaryNode).b)
            ]));
        case AstType.Number:
            return makeTag('Number', { type: ValueType.Number, value: (ast as NumberNode).n } as NumberValue);
        case AstType.String:
            return makeTag('String', { type: ValueType.String, value: (ast as StringNode).s } as StringValue);
        case AstType.Id:
            return makeTag('Id', { type: ValueType.String, value: (ast as IdNode).i } as StringValue);
        case AstType.Bool:
            return makeTag('Bool', { type: ValueType.Bool, value: (ast as BoolNode).b } as BoolValue);
        case AstType.None:
            return makeTag('None');
        case AstType.Array:
            return makeTag('Array', makeArrayValue((ast as ArrayNode).body.map(x => astToNoktoyValue(x))));
        case AstType.Record: {
            const node = ast as RecordNode;
            const bodyMap = new Map<Value, Value>();
            for (const [k, v] of node.body) {
                bodyMap.set(astToNoktoyValue(k), astToNoktoyValue(v));
            }
            return makeTag('Record', makeArrayValue([
                node.name ? { type: ValueType.String, value: node.name } as StringValue : { type: ValueType.None } as NoneValue,
                makeRecordValue(bodyMap)
            ]));
        }
        case AstType.Call:
            return makeTag('Call', makeArrayValue([
                astToNoktoyValue((ast as CallNode).caller),
                makeArrayValue((ast as CallNode).args.map(x => astToNoktoyValue(x)))
            ]));
        case AstType.Member:
            return makeTag('Member', makeArrayValue([
                astToNoktoyValue((ast as MemberNode).left),
                { type: ValueType.String, value: ((ast as MemberNode).right as IdNode).i } as StringValue,
                astToNoktoyValue((ast as MemberNode).right)
            ]));
        case AstType.Unary:
            return makeTag('Unary', makeArrayValue([
                { type: ValueType.String, value: (ast as UnaryNode).op } as StringValue,
                astToNoktoyValue((ast as UnaryNode).right)
            ]));
        case AstType.If: {
            const node = ast as IfNode;
            return makeTag('If', makeArrayValue([
                astToNoktoyValue(node.cond),
                makeArrayValue(node.body.map(x => astToNoktoyValue(x))),
                node.else ? (
                    node.elseT === 1 ? astToNoktoyValue(node.else as IfNode) :
                    makeArrayValue((node.else as Ast[]).map(x => astToNoktoyValue(x)))
                ) : { type: ValueType.None } as NoneValue
            ]));
        }
        case AstType.Match: {
            const node = ast as MatchNode;
            const bodyMap = new Map<Value, Value>();
            for (const [k, v] of node.body) {
                bodyMap.set(
                    makeArrayValue(k.map(x => astToNoktoyValue(x))),
                    makeArrayValue(v.map(x => astToNoktoyValue(x)))
                );
            }
            return makeTag('Match', makeArrayValue([
                astToNoktoyValue(node.cond),
                makeRecordValue(bodyMap),
                node.default ? makeArrayValue(node.default.map(x => astToNoktoyValue(x))) : { type: ValueType.None } as NoneValue
            ]));
        }
        case AstType.While:
            return makeTag('While', makeArrayValue([
                astToNoktoyValue((ast as WhileNode).cond),
                makeArrayValue((ast as WhileNode).body.map(x => astToNoktoyValue(x)))
            ]));
        case AstType.ForOf:
            return makeTag('ForOf', makeArrayValue([
                { type: ValueType.String, value: (ast as ForOfNode).a } as StringValue,
                { type: ValueType.String, value: (ast as ForOfNode).b } as StringValue,
                astToNoktoyValue((ast as ForOfNode).iterator),
                makeArrayValue((ast as ForOfNode).body.map(x => astToNoktoyValue(x)))
            ]));
        case AstType.Break:
            return makeTag('Break');
        case AstType.Continue:
            return makeTag('Continue');
        case AstType.Return:
            return makeTag('Return', astToNoktoyValue((ast as ReturnNode).value));
        case AstType.Err:
            return makeTag('Err', astToNoktoyValue((ast as ErrNode).val));
        case AstType.Do:
            return makeTag('Do', makeArrayValue((ast as DoNode).body.map(x => astToNoktoyValue(x))));
        case AstType.Catch:
            return makeTag('Catch', makeArrayValue([
                astToNoktoyValue((ast as CatchNode).exp),
                { type: ValueType.String, value: (ast as CatchNode).name } as StringValue,
                makeArrayValue((ast as CatchNode).body.map(x => astToNoktoyValue(x)))
            ]));
        case AstType.Ext:
            return makeTag('Ext', astToNoktoyValue((ast as ExtNode).file));
        default:
            return makeTag('None');
    }
}

//! AI Warning
// I used AI to make this function because I didn't want to type it out-- haha
// No code quality checks were done here, I just hope it works
export function noktoyValueToAst(value: Value): Ast {
    const makeTag = (name: string, tagged?: Value) => ({ 
        type: ValueType.Tag, 
        parent: astTag, 
        name, 
        tagged 
    } as TagValue);

    const makeArrayValue = (vals: Value[]) => ({
        type: ValueType.Array,
        val: vals
    } as ArrayValue);

    const makeRecordValue = (vals: Map<Value, Value>) => ({
        type: ValueType.Object,
        val: new Map([...vals].map(([k, v]) => [JSON.stringify(k), v]))
    } as ObjectValue);

    switch (value.type) {
        case ValueType.Tag: {
            const tag = value as TagValue;
            if (tag.parent !== astTag) {
                throw new Error('Not an AST tag');
            }

            // Add missing AST node cases:
            switch (tag.name) {
                case 'TagDecl': {
                    const arr = (tag.tagged as ArrayValue).val;
                    const name = (arr[0] as StringValue).value;
                    const nontagged = new Map<string, undefined>();
                    const tagged = new Map<string, Type>();
                    
                    // Convert nontagged map
                    const nontaggedObj = arr[1] as ObjectValue;
                    for (const [k, _] of nontaggedObj.val) {
                        nontagged.set(JSON.parse(k).value, undefined);
                    }

                    // Convert tagged map
                    const taggedObj = arr[2] as ObjectValue;
                    for (const [k, v] of taggedObj.val) {
                        tagged.set(JSON.parse(k).value, (v as TagValue).tagged as unknown as Type);
                    }

                    return {
                        type: AstType.TagDecl,
                        name,
                        nontagged,
                        tagged,
                        line: 0
                    } as TagDeclNode;
                }

                case 'StructDecl': {
                    const structValue = tag.tagged as StructValue;
                    const structFields = structValue.fields.get('fields')?.[0] as ObjectValue;
                    const structStaticFields = structValue.fields.get('staticFields')?.[0] as ObjectValue;
                    const structFuns = structValue.fields.get('funs')?.[0] as ObjectValue;
                    const structStaticFuns = structValue.fields.get('staticFuns')?.[0] as ObjectValue;

                    // Helper to convert Value to Type
                    function valueToType(val: Value): Type {
                        if (val.type === ValueType.Tag) {
                            if (val && val.type === ValueType.Tag) {
                                return ((val as TagValue).tagged as unknown) as Type;
                            }
                            throw new Error("Cannot convert Value to Type");
                        }
                        throw new Error("Cannot convert Value to Type");
                    }

                    return {
                        type: AstType.StructDecl,
                        name: (structValue.fields.get('name')?.[0] as StringValue).value,
                        fields: new Map([...structFields.val]
                            .map(([k, v]) => [JSON.parse(k).value, valueToType(v)])),
                        staticFields: new Map([...structStaticFields.val]
                            .map(([k, v]) => [JSON.parse(k).value, [
                                valueToType((v as ArrayValue).val[0]),
                                noktoyValueToAst((v as ArrayValue).val[1])
                            ]])),
                        funs: new Map([...structFuns.val]
                            .map(([k, v]) => [JSON.parse(k).value, noktoyValueToAst(v) as FunDeclNode])),
                        staticFuns: new Map([...structStaticFuns.val]
                            .map(([k, v]) => [JSON.parse(k).value, noktoyValueToAst(v) as FunDeclNode])),
                        line: 0
                    } as StructDeclNode;
                }

                case 'Return': {
                    return {
                        type: AstType.Return,
                        value: noktoyValueToAst(tag.tagged as Value),
                        line: 0
                    } as ReturnNode;
                }

                case 'Do': {
                    return {
                        type: AstType.Do,
                        body: (tag.tagged as ArrayValue).val.map(x => noktoyValueToAst(x)),
                        line: 0
                    } as DoNode;
                }

                case 'Binary': {
                    const arr = (tag.tagged as ArrayValue).val;
                    return {
                        type: AstType.Binary,
                        a: noktoyValueToAst(arr[0]),
                        op: (arr[1] as StringValue).value,
                        b: noktoyValueToAst(arr[2]),
                        line: 0
                    } as BinaryNode;
                }

                case 'Unary': {
                    const arr = (tag.tagged as ArrayValue).val;
                    return {
                        type: AstType.Unary,
                        op: (arr[0] as StringValue).value,
                        right: noktoyValueToAst(arr[1]),
                        line: 0
                    } as UnaryNode;
                }

                case 'Array': {
                    return {
                        type: AstType.Array,
                        body: (tag.tagged as ArrayValue).val.map(x => noktoyValueToAst(x)),
                        line: 0
                    } as ArrayNode;
                }

                case 'Number': {
                    return {
                        type: AstType.Number,
                        n: (tag.tagged as NumberValue).value,
                        line: 0
                    } as NumberNode;
                }

                case 'String': {
                    return {
                        type: AstType.String,
                        s: (tag.tagged as StringValue).value,
                        line: 0
                    } as StringNode;
                }

                case 'Id': {
                    return {
                        type: AstType.Id,
                        i: (tag.tagged as StringValue).value,
                        line: 0
                    } as IdNode;
                }

                case 'Bool': {
                    return {
                        type: AstType.Bool,
                        b: (tag.tagged as BoolValue).value,
                        line: 0
                    } as BoolNode;
                }

                case 'None': {
                    return {
                        type: AstType.None,
                        line: 0
                    };
                }
                
                case 'Ext': {
                    return {
                        type: AstType.Ext,
                        file: noktoyValueToAst(tag.tagged as Value),
                        line: 0
                    } as ExtNode;
                }

                case 'Break': {
                    return {
                        type: AstType.Break,
                        line: 0
                    };
                }

                case 'Continue': {
                    return {
                        type: AstType.Continue,
                        line: 0
                    };
                }

                default:
                    throw new Error(`Unhandled AST tag type: ${tag.name}`);
            }
        }
        default:
            throw new Error(`Cannot convert value type ${value.type} to AST`);
    }
}

// deno-lint-ignore no-explicit-any
function mapEnum(en: any): StaticTagValue {
    const nontagged = new Map<string, undefined>();

    for (const v of Object.values(en)) {
        if (typeof v == "string") {
            nontagged.set(v, undefined);
        }
    }

    return { type: ValueType.StaticTag, nontagged, tagged: new Map() } as StaticTagValue;
}

const typeEnum = mapEnum(ValueType);
noktoy_lib.set('Type', { mutable: false, type: { type: TypeType.Any } as AnyType, value: typeEnum });

noktoy_lib.set('typeof', { mutable: false, type: { type: TypeType.Any } as AnyType, value: { type: ValueType.Native, body: 
    async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (args.length != 1) {
            throw `invalid function signature for Std::Noktoy::typeof`;
        }
        return { type: ValueType.Tag, parent: typeEnum, name: ValueType[args[0].type], tagged: undefined } as TagValue;
    }
} as NativeFunValue })

noktoy_lib.set('execAst', { mutable: false, type: { type: TypeType.Any } as AnyType, value: { type: ValueType.Native, body: 
    async (args: Value[], scope: Scope, i: Interpreter): Promise<Value> => {
        if (
            args.length != 1 ||
            args[0].type != ValueType.Tag ||
            JSON.stringify((args[0] as TagValue).parent) != JSON.stringify(astTag)
        ) {
            throw `invalid function signature for Std::Noktoy::execAst`;
        }
        return await i.run(noktoyValueToAst(args[0]), scope);
    }
} as NativeFunValue })

noktoy_lib.set('makeMacro', { mutable: false, type: { type: TypeType.Any } as AnyType, value: { type: ValueType.Native, body: 
    async (args: Value[], scope: Scope, i: Interpreter): Promise<Value> => {
        if (
            args.length != 1 ||
            args[0].type != ValueType.Fun
        ) {
            throw `invalid function signature for Std::Noktoy::makeMacro`;
        }
        return {
            type: ValueType.NativeMacro,
            body: async (macArgs: Ast[], _s: Scope, i: Interpreter): Promise<Value> => {
                const newAst = new Array<Value>();
                for (const arg of macArgs) {
                    newAst.push(astToNoktoyValue(arg));
                }
                return await i.runFun(args[0] as FunValue, [{ type: ValueType.Array, val: newAst } as ArrayValue], (args[0] as FunValue).scope);
            }
        } as NativeMacroValue;
    }
} as NativeFunValue })

noktoy_lib.set('runningTarget', { mutable: false, type: { type: TypeType.Any } as AnyType, value: { type: ValueType.Native, body: 
    async (_args: Value[], _scope: Scope, i: Interpreter): Promise<Value> => {
        const o = new Map();
        o.set('{"type":2,"value":"target"}', { type: ValueType.String, value: Deno.build.target } as StringValue);
        o.set('{"type":2,"value":"arch"}', { type: ValueType.String, value: Deno.build.arch } as StringValue);
        o.set('{"type":2,"value":"os"}', { type: ValueType.String, value: Deno.build.os } as StringValue);
        o.set('{"type":2,"value":"vendor"}', { type: ValueType.String, value: Deno.build.vendor } as StringValue);
        o.set('{"type":2,"value":"env"}', Deno.build.env == undefined ? { type: ValueType.None } as NoneValue : { type: ValueType.String, value: Deno.build.env } as StringValue);

        return {
            type: ValueType.Object,
            val: o,
        } as ObjectValue;
    }
} as NativeFunValue })