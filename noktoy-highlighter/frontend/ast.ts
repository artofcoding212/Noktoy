import { Type } from "./types.ts";

//! Make sure to implement new AST nodes into the astToNotkoyValue() function in std/noktoy.ts

export enum AstType {
    //? statements
    VarDecl, // let/mut <name>: <Type?> = <exp>
    //! This is also an expression as you can do fun literals (i.e. "fun(a,b) {}")
    FunDecl, // fun <name?>(<name>: <Type?>..., <name>: <Type?>, ...) <Type?> {}
    TagDecl, // tag <name> { <name>(<Type>)<?>, ... }
    Return, // ret <exp>
    UseName, // use name as <name?>
    UseBasic, // use <name>::<name> as <name?>
    UseExpand, // use <name>::{<name> as <name?>, ...}
    // Namespace, // nsp <name>(<name>, <name>, ...) {}
    StructDecl, // str Name { <name> <Type> !<name>(<params>) <ret> {} ?<name>(<params>) <ret> {} <name>(<params>) <ret> {} }
    While, // whl <exp> <body>
    ForOf, // for x, y of z {}
    Break, // brk
    Continue, // cnt
    Err, // err <exp>

    //? expressions
    Ext, // ext <exp>
    Do, // do <body>
    Catch, // <exp> cat <name> <body>
    If, // if <exp> <body> els<?> <If|body>
    Match, // mat <exp> { <exp>, <exp>, ... <body> ... }
    Binary, // <exp> op <exp>
    Unary, // op <exp>
    Number, // number literal
    String, // string literal
    Id, // identifier literal
    Bool, // true/false
    None, // none
    Call, // <exp>(<exp>, <exp>, ...)
    Array, // [<exp>, <exp>...]
    Record, //  <name?> { <exp> -> <exp>, <exp> -> <exp>, ... }
    Member, // <exp>.<exp>, <exp>[<exp>], <exp>:<exp>, <exp>::<exp>
}

export interface Ast {
    type: AstType;
    line: number;
}

export interface ExtNode extends Ast {
    file: Ast;
}

export interface DoNode extends Ast {
    body: Ast[];
}

export interface ErrNode extends Ast {
    val: Ast;
}

export interface CatchNode extends Ast {
    exp: Ast;
    name: string;
    body: Ast[];
}

export interface BreakNode extends Ast {}
export interface ContinueNode extends Ast {}

export interface MatchNode extends Ast {
    cond: Ast;
    body: Map<Ast[], Ast[]>; // Ast[] key for matchee expressions (mutliple are allowed), Ast[] value for body
    default?: Ast[];
}

export interface TagDeclNode extends Ast {
    name: string;
    tagged: Map<string, Type>;
    nontagged: Map<string, undefined>;
}

export interface IfNode extends Ast {
    cond: Ast;
    body: Ast[];
    elseT: number; // 0 = none, 1 = else if, 2 = else
    else?: IfNode|Ast[];
}

export interface WhileNode extends Ast {
    cond: Ast;
    body: Ast[];
}

export interface ForOfNode extends Ast {
    a: string;
    b: string;
    iterator: Ast;
    body: Ast[];
}

export interface StructDeclNode extends Ast {
    name: string;
    fields: Map<string, Type>;
    staticFields: Map<string, [Type, Ast]>; //? A static member is a member that can be accessed on the struct container
    funs: Map<string, FunDeclNode>;
    staticFuns: Map<string, FunDeclNode>;
}

export interface UnaryNode extends Ast {
    op: string;
    right: Ast;
}

export enum MemberType {
    Default, // <exp>.<exp>
    Computed, // <exp>[<exp>]
    CallSelf, // <exp>:<exp>, though it only works in the <exp>:<exp>() syntax
    NamespaceAccess, // <exp>::<exp>
}

export interface MemberNode extends Ast {
    kind: MemberType;
    left: Ast;
    right: Ast;
}

export interface UseNode extends Ast {}

export interface UseNameNode extends UseNode {
    name: string;
    as?: string;
}

export interface UseBasicNode extends UseNode {
    left: UseNode;
    right: UseNameNode;
    as?: string;
}

export interface UseExpandNode extends UseNode {
    left: UseNode;
    body: UseNode[];
}

export interface VarDeclNode extends Ast {
    name: string;
    value: Ast;
    t: Type;
    mutable: boolean;
}

export interface FunDeclNode extends Ast {
    name?: string;
    params: [string, Type, boolean][]; // Name, Type, Mutable
    ret: Type;
    body: Ast[];
}

export interface BinaryNode extends Ast {
    a: Ast;
    b: Ast;
    op: string;
}

export interface ReturnNode extends Ast {
    value: Ast;
}

export interface NumberNode extends Ast {
    n: number;
}

export interface RecordNode extends Ast {
    name?: string;
    body: Map<Ast, Ast>;
}

export interface StringNode extends Ast {
    s: string;
}

export interface IdNode extends Ast {
    i: string;
}

export interface BoolNode extends Ast {
    b: boolean;
}

export interface CallNode extends Ast {
    caller: Ast;
    args: Ast[];
}

export interface ArrayNode extends Ast {
    body: Ast[];
}

export interface NoneNode extends Ast {}