// deno-lint-ignore-file require-await
import * as path from "@std/path";
import { Interpreter, Scope, Variable } from "../backend/interpreter.ts";
import { AnyType, BoolType, NoneType, NumberType, OrType, Type, TypeType } from "../shared/types.ts";
import { ArrayValue, BoolValue, FunValue, NativeFunValue, NoneValue, NumberValue, ObjectValue, PointerValue, StaticStructValue, StringValue, StructValue, Value, ValueType } from "../shared/values.ts";

// Type helpers
const tnum = { type: TypeType.Number } as NumberType;
const tbool = { type: TypeType.Bool } as BoolType;
const tnone = { type: TypeType.None } as NoneType;
const tor = (a: Type, b: Type): OrType => ({ type: TypeType.Or, a, b });

export const fs_lib = new Map<string, Variable>();

/*

Std::Fs
|> Standard library entry for interacting with the filesystem.

Contributors
* artofcoding212 (Github & Discord)

Documentation
* thisPath() String
   | Returns the path to the current file.
* dirName(path: String) String
   | Returns the name of the directory in which the given file is parented under.
* resolve(...String) String
   | Resolves path segments into a full path. Can be useful for making true relative imports.
* readFile(path: String) String
   | Reads the file and returns the contents.
   | This can throw an exception which you can catch.
* writeFile(path: String, contents: String)
   | Writes to the file with the given contents.
   | This can throw an exception which you can catch.
* deleteFile(path: String)
   | Deletes the given file.
   | This can throw an exception which you can catch.
* fileStat(path: String) FileStats
   | Returns various information about the given file.
   | This can throw an exception which you can catch.
* FileStats: Struct
   Fields
    size Number (bytes)
    isDir Bool
    isFile Bool
    creationDate Number|None (ms)

*/

fs_lib.set("thisPath", {mutable:false,type:{type:TypeType.Any}as AnyType, value: { type: ValueType.Native, body:
    async (_args: Value[], _scope: Scope, i: Interpreter): Promise<Value> => {
        return { type: ValueType.String, value: i.currentFile } as StringValue;
    }
}as NativeFunValue});

fs_lib.set("dirName", {mutable:false,type:{type:TypeType.Any}as AnyType, value: { type: ValueType.Native, body:
    async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (args.length != 1 || args[0].type != ValueType.String) {
            throw `invalid function signature to Std::Fs::dirname`;
        }
        return { type: ValueType.String, value: path.dirname((args[0] as StringValue).value) } as StringValue;
    }
}as NativeFunValue});

fs_lib.set("resolve", {mutable:false,type:{type:TypeType.Any}as AnyType, value: { type: ValueType.Native, body:
    async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        const arr = [];
        for (const x of args) {
            if (x.type != ValueType.String) {
                throw `invalid function signature to Std::Fs::resolve`;
            }
            arr.push((x as StringValue).value);
        }
        return { type: ValueType.String, value: path.resolve(...arr) } as StringValue;
    }
}as NativeFunValue});

const fileStats = {
    type: ValueType.StaticStruct,
    fields: new Map([
        ['size', tnum],
        ['isDir', tbool], 
        ['isFile', tbool],
        ['creationDate', tor(tnum, tnone)]
    ]),
    staticFields: new Map(),
    funs: new Map(),
    staticFuns: new Map()
} as StaticStructValue;

fs_lib.set('FileStats', {mutable:false,type:{type:TypeType.Any}as AnyType, value: fileStats});

fs_lib.set("readFile", {mutable:false,type:{type:TypeType.Any}as AnyType, value: { type: ValueType.Native, body:
    async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (args.length != 1 || args[0].type != ValueType.String) {
            return { type: ValueType.String, value: "invalid function signature to Std::Fs::readFile" } as StringValue;
        }
        try {
            const contents = await Deno.readTextFile((args[0] as StringValue).value);
            return { type: ValueType.String, value: contents } as StringValue;
        } catch(e: unknown) {
            const error = e as Error;
            throw { type: ValueType.String, value: `Failed to read file: ${error.message}` } as StringValue;
        }
    }
}as NativeFunValue});

fs_lib.set("writeFile", {mutable:false,type:{type:TypeType.Any}as AnyType, value: { type: ValueType.Native, body:
    async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (args.length != 2 || args[0].type != ValueType.String || args[1].type != ValueType.String) {
            return { type: ValueType.String, value: "invalid function signature to Std::Fs::writeFile" } as StringValue;
        }
        try {
            await Deno.writeTextFile((args[0] as StringValue).value, (args[1] as StringValue).value);
            return { type: ValueType.None } as NoneValue;
        } catch(e: unknown) {
            const error = e as Error;
            throw { type: ValueType.String, value: `Failed to write file: ${error.message}` } as StringValue;
        }
    }
}as NativeFunValue});

fs_lib.set("deleteFile", {mutable:false,type:{type:TypeType.Any}as AnyType, value: { type: ValueType.Native, body:
    async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (args.length != 1 || args[0].type != ValueType.String) {
            return { type: ValueType.String, value: "invalid function signature to Std::Fs::deleteFile" } as StringValue;
        }
        try {
            await Deno.remove((args[0] as StringValue).value);
            return { type: ValueType.None } as NoneValue;
        } catch(e: unknown) {
            const error = e as Error;
            throw { type: ValueType.String, value: `Failed to delete file: ${error.message}` } as StringValue;
        }
    }
}as NativeFunValue});

fs_lib.set("fileStat", {mutable:false,type:{type:TypeType.Any}as AnyType, value: { type: ValueType.Native, body:
    async (args: Value[], _scope: Scope, _i: Interpreter): Promise<Value> => {
        if (args.length != 1 || args[0].type != ValueType.String) {
            return { type: ValueType.String, value: "invalid function signature to Std::Fs::fileStat" } as StringValue;
        }
        try {
            const stat = await Deno.stat((args[0] as StringValue).value);
            return {
                type: ValueType.Struct,
                parent: fileStats,
                fields: new Map([
                    ['size', [{ type: ValueType.Number, value: stat.size } as NumberValue, tnum]],
                    ['isDir', [{ type: ValueType.Bool, value: stat.isDirectory } as BoolValue, tbool]],
                    ['isFile', [{ type: ValueType.Bool, value: stat.isFile } as BoolValue, tbool]],
                    ['creationDate', [stat.birthtime ? 
                        { type: ValueType.Number, value: stat.birthtime.getTime() } as NumberValue :
                        { type: ValueType.None } as NoneValue, 
                        tor(tnum, tnone)]]
                ])
            } as StructValue;
        } catch(e: unknown) {
            const error = e as Error;
            throw { type: ValueType.String, value: `Failed to get file stats: ${error.message}` } as StringValue;
        }
    }
}as NativeFunValue});