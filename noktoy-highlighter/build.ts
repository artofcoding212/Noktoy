import * as esbuild from 'npm:esbuild';
import { denoPlugins } from 'jsr:@luca/esbuild-deno-loader';

await esbuild.build({
    plugins: [...denoPlugins()],
    entryPoints: ["./client.ts"],
    outfile: "./client_out.js",
    bundle: true,
    format: "cjs",
    platform: "node",
    external: [
        'vscode',
        'path',
        'vscode-languageclient',
        'vscode-languageserver',
        'vscode-languageserver-textdocument'
    ]
});

await esbuild.build({
    plugins: [...denoPlugins()],
    entryPoints: ["./server.ts"],
    outfile: "./server_out.js",
    bundle: true,
    format: "cjs",
    platform: "node",
    external: [
        'vscode',
        'path',
        'vscode-languageclient',
        'vscode-languageserver',
        'vscode-languageserver-textdocument'
    ]
});

esbuild.stop();