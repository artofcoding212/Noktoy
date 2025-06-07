import { Scope, Variable } from "../backend/interpreter.ts";;
import { ValueType, NamespaceValue } from '../shared/values.ts';
import { AnyType, TypeType } from "../shared/types.ts";
import { io_lib } from "./io.ts";
import { str_lib } from "./string.ts";
import { arr_lib } from './array.ts';
import { ffi_lib } from "./ffi.ts";
import { math_lib } from "./math.ts";
import { noktoy_lib } from "./noktoy.ts";
import { thread_str } from "./thread.ts";
import { time_lib } from "./time.ts";
import { fs_lib } from "./fs.ts";
import { http_lib } from "./http.ts";

export const lib = new Map<string, Variable>();

//! Std::String
lib.set("String", {
    mutable: false,
    value: {
        type: ValueType.Namespace,
        scope: { parent: undefined, members: str_lib } as Scope,
    } as NamespaceValue,
    type: { type: TypeType.Any } as AnyType,
});

//! Std::Io
lib.set("Io", {
    mutable: false,
    value: {
        type: ValueType.Namespace,
        scope: { parent: undefined, members: io_lib } as Scope,
    } as NamespaceValue,
    type: { type: TypeType.Any } as AnyType,
});

//! Std::Array
lib.set("Array", {
    mutable: false,
    value: {
        type: ValueType.Namespace,
        scope: { parent: undefined, members: arr_lib } as Scope,
    } as NamespaceValue,
    type: { type: TypeType.Any } as AnyType,
});

//! Std::FFI
lib.set("FFI", {
    mutable: false,
    value: {
        type: ValueType.Namespace,
        scope: { parent: undefined, members: ffi_lib } as Scope,
    } as NamespaceValue,
    type: { type: TypeType.Any } as AnyType,
});

//! Std::Math
lib.set("Math", {
    mutable: false,
    value: {
        type: ValueType.Namespace,
        scope: { parent: undefined, members: math_lib } as Scope,
    } as NamespaceValue,
    type: { type: TypeType.Any } as AnyType,
});

//! Std::Noktoy
lib.set("Noktoy", {
    mutable: false,
    value: {
        type: ValueType.Namespace,
        scope: { parent: undefined, members: noktoy_lib } as Scope,
    } as NamespaceValue,
    type: { type: TypeType.Any } as AnyType,
});

//! Std::Thread
lib.set("Thread", {
    mutable: false,
    value: thread_str,
    type: { type: TypeType.Any } as AnyType,
})

//! Std::Time
lib.set("Time", {
    mutable: false,
    value: {
        type: ValueType.Namespace,
        scope: { parent: undefined, members: time_lib } as Scope,
    } as NamespaceValue,
    type: { type: TypeType.Any } as AnyType,
})

//! Std::Fs
lib.set("Fs", {
    mutable: false,
    value: {
        type: ValueType.Namespace,
        scope: { parent: undefined, members: fs_lib } as Scope,
    } as NamespaceValue,
    type: { type: TypeType.Any } as AnyType,
})

//! Std::Http
lib.set("Http", {
    mutable: false,
    value: {
        type: ValueType.Namespace,
        scope: { parent: undefined, members: http_lib } as Scope,
    } as NamespaceValue,
    type: { type: TypeType.Any } as AnyType,
})