// deno-lint-ignore-file require-await no-unused-vars
import { Interpreter, Scope, Variable } from "../backend/interpreter.ts";
import { AnyType, BoolType, NumberType, StringType, TypeType } from "../shared/types.ts";
import { ArrayValue, BoolValue, FunValue, NativeFunValue, NoneValue, NumberValue, ObjectValue, PointerValue, StaticStructValue, StaticTagValue, StringValue, StructValue, Value, ValueType } from "../shared/values.ts";
import { noktoyValueToTsValue, tsValueNoktoyValue } from "./ffi.ts"

export const http_lib: Map<string, Variable> = new Map();

/*

Std::Http
|> Standard library entry for interacting with the internet.

Contributors
* artofcoding212 (Github & Discord)

Documentation
* jsonStringify(json: JSON|Any) String
   | Returns the stringification of the given JSON object.
* jsonParse(a: String) <Any: Any>
   | Returns an object from the given JSON string.
* serve(handler: fun(r: Request) Response, port: Number)
   | Hosts a server that handles requests and responds on the given port.
* Request: Struct
   | Represents a request.
   Fields
    method: String
    url: { path: String, port: String, origin: String }
   Methods
    [THROWS] jsons(self: Request) <Any: Any> 
       | Returns the JSON representation of the Request.
* Response: Response
   | Represents the response of a fetch() or the response of a server request
   Static methods
    new(content: String, data: { optional status: Number, optional headers: <String, String> })
       | Returns a new Response. This should really only be used in the response to a server request
   Methods
    [THROWS] json(self: Response)
       | Returns the JSON representation of the Response.
    text(self: Response)
       | Returns the text body of the Response.
   Fields
    ok: Bool
    status: Number
*/

http_lib.set("jsonStringify", { mutable: false, type: { type:TypeType.Any } as AnyType, value: { type: ValueType.Native, body:
    async (args: Value[], s: Scope, i: Interpreter): Promise<Value> => {
        if (args.length != 1 || args[0].type != ValueType.Object) {
            throw `invalid function signature to Std::Http::jsonStringify`;
        }
        if ('JSON_lit' in args[0]) {
            return { type: ValueType.String, value: JSON.stringify(args[0].JSON_lit) } as StringValue;
        }
        return { type: ValueType.String, value: JSON.stringify(noktoyValueToTsValue(args[0], s, i)) } as StringValue;
    }
} as NativeFunValue })

http_lib.set("jsonParse", { mutable: false, type: { type:TypeType.Any } as AnyType, value: { type: ValueType.Native, body:
    async (args: Value[], scope: Scope, i: Interpreter): Promise<Value> => {
        if (args.length != 1 || args[0].type != ValueType.String) {
            throw `invalid function signature to Std::Http::jsonParse`;
        }
        return tsValueNoktoyValue(JSON.parse((args[0] as StringValue).value), scope, i);
    }
} as NativeFunValue })

const request_struct = {
    type: ValueType.StaticStruct,
    staticFields: new Map(),
    fields: new Map(),
    funs: new Map(),
    staticFuns: new Map()
} as StaticStructValue;

request_struct.funs.set('json', { type: ValueType.Native, body:
    async (args: Value[], s: Scope, i: Interpreter): Promise<Value> => {
        if (args.length != 1 || !('request' in args[0])) {
            throw 'invalid function signature to Std::Http::Request::JSON()';
        }
        try {
            return tsValueNoktoyValue(await (args[0].request as Request).json(), s, i);
        } catch (e) {
            throw tsValueNoktoyValue(e, s, i);
        }
    }
} as NativeFunValue);

request_struct.funs.set('text', { type: ValueType.Native, body:
    async (args: Value[], s: Scope, i: Interpreter): Promise<Value> => {
        if (args.length != 1 || !('request' in args[0])) {
            throw 'invalid function signature to Std::Http::Request::text()';
        }
        return { type: ValueType.String, value: await (args[0].request as Request).text() } as StringValue;
    }
} as NativeFunValue);

request_struct.funs.set('abort', { type: ValueType.Native, body:
    async (args: Value[], s: Scope, i: Interpreter): Promise<Value> => {
        if (args.length != 1 || !('abortSig' in args[0])) {
            throw 'invalid function signature to Std::Http::Request::abort()';
        }
        (args[0].abortSig as AbortController).abort();
        return { type: ValueType.None } as NoneValue;
    }
} as NativeFunValue);

const response_struct = {
    type: ValueType.StaticStruct,
    staticFields: new Map(),
    fields: new Map(),
    funs: new Map(),
    staticFuns: new Map()
} as StaticStructValue;

response_struct.funs.set('json', { type: ValueType.Native, body:
    async (args: Value[], s: Scope, i: Interpreter): Promise<Value> => {
        if (args.length != 1 || !('response' in args[0])) {
            throw 'invalid function signature to Std::Http::Response::json()';
        }
        try {
            return tsValueNoktoyValue(await (args[0].response as Response).json(), s, i);
        } catch (e) {
            throw tsValueNoktoyValue(e, s, i);
        }
    }
} as NativeFunValue);

response_struct.funs.set('text', { type: ValueType.Native, body:
    async (args: Value[], s: Scope, i: Interpreter): Promise<Value> => {
        if (args.length != 1 || !('response' in args[0])) {
            throw 'invalid function signature to Std::Http::Response::text()';
        }
        return {
            type: ValueType.String,
            value: await (args[0].response as Response).text(),
        } as StringValue;
    }
} as NativeFunValue);

response_struct.staticFuns.set('new', { type: ValueType.Native, body:
    async (args: Value[], s: Scope, i: Interpreter): Promise<Value> => {
        if (args.length != 2 || args[0].type != ValueType.String || args[1].type != ValueType.Object) {
            throw 'invalid function signature to static method Std::Http::Response::new()';
        }

        return {
            type: ValueType.Struct,
            parent: response_struct,
            fields: new Map(),
            response: new Response((args[0] as StringValue).value, noktoyValueToTsValue(args[1], s, i))
        } as StructValue;
    }
} as NativeFunValue);

http_lib.set("serve", { mutable: false, type: { type:TypeType.Any } as AnyType, value: { type: ValueType.Native, body:
    async (args: Value[], scope: Scope, i: Interpreter): Promise<Value> => {
        if (args.length != 2 || args[0].type != ValueType.Fun || args[1].type != ValueType.Object) {
            throw `invalid function signature to Std::Http::serve()`;
        }
        const sig = new AbortController();
        const servePort = (args[1] as ObjectValue).val.has('{"type":2,"value":"port"}') ? ((args[1] as ObjectValue).val.get('{"type":2,"value":"port"}') as Value) : undefined;
        const serveHost = (args[1] as ObjectValue).val.has('{"type":2,"value":"host"}') ? ((args[1] as ObjectValue).val.get('{"type":2,"value":"host"}') as Value) : undefined;
        const a = Deno.serve({ 
            port: servePort == undefined ? undefined : (servePort.type == ValueType.Number ? (servePort as NumberValue).value : undefined),
            hostname: serveHost == undefined ? undefined : (serveHost.type == ValueType.String ? (serveHost as StringValue).value : undefined),
            signal: sig.signal
        },
            async (r: Request): Promise<Response> => {
                const url = new URL(r.url);
                const req_str = {
                    type: ValueType.Struct,
                    parent: request_struct,
                    fields: new Map(),
                    request: r,
                    abortSig: sig,
                } as StructValue;
                req_str.fields.set('method', [{ type: ValueType.String, value: r.method } as StringValue, { type: TypeType.String } as StringType]);
                const url_obj = new Map();
                url_obj.set('{"type":2,"value":"path"}', { type: ValueType.String, value: url.pathname } as StringValue);
                url_obj.set('{"type":2,"value":"port"}', { type: ValueType.String, value: url.port } as StringValue);
                url_obj.set('{"type":2,"value":"origin"}', { type: ValueType.String, value: url.origin } as StringValue);
                req_str.fields.set('url', [{ type: ValueType.Object, val: url_obj } as ObjectValue, { type: TypeType.Any } as AnyType]);
                const res = await i.runFun(args[0] as FunValue, [req_str], scope);
                if (!('response' in res)) {
                    throw `invalid function signature to Std::Http::serve()`;
                }
                return res.response as Response;
            }
        );
        let finish = false;
        a.finished.then(() => {
            finish = true;
        });
        const result_obj = new Map();
        result_obj.set('{"type":2,"value":"abort"}', { type: ValueType.Native, body:
            async (args: Value[], scope: Scope, i: Interpreter): Promise<Value> => {
                sig.abort();
                return { type: ValueType.None } as NoneValue;
            }
        });
        result_obj.set('{"type":2,"value":"isFinished"}', { type: ValueType.Native, body:
            async (args: Value[], scope: Scope, i: Interpreter): Promise<Value> => {
                return { type: ValueType.Bool, value: finish } as BoolValue;
            }
        });
        result_obj.set('{"type":2,"value":"await"}', { type: ValueType.Native, body:
            async (args: Value[], scope: Scope, i: Interpreter): Promise<Value> => {
                await a.finished;
                return { type: ValueType.None } as NoneValue;
            }
        });
        return { type: ValueType.Object, val: result_obj } as ObjectValue;
    }
} as NativeFunValue })

http_lib.set("fetch", { mutable: false, type: { type:TypeType.Any } as AnyType, value: { type: ValueType.Native, body:
    async (args: Value[], s: Scope, i: Interpreter): Promise<Value> => {
        if (args.length != 2 || args[0].type != ValueType.String || args[1].type != ValueType.Object) {
            throw `invalid function signature to Std::Http::fetch()`;
        }

        const resp = await fetch((args[0] as StringValue).value, noktoyValueToTsValue(args[1], s, i));
        const r = {
            type: ValueType.Struct,
            parent: response_struct,
            fields: new Map(),
            response: resp,
        } as StructValue;
        r.fields.set('ok', [{ type: ValueType.Bool, value: resp.ok } as BoolValue, { type: TypeType.Bool } as BoolType]);
        r.fields.set('status', [{ type: ValueType.Number, value: resp.status } as NumberValue, { type: TypeType.Number } as NumberType]);
    
        return r;
    }
} as NativeFunValue })

http_lib.set('Request', { mutable: false, type: {type:TypeType.Any} as AnyType, value:request_struct })
http_lib.set('Response', { mutable: false, type: {type:TypeType.Any} as AnyType, value:response_struct })