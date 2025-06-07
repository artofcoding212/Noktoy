import * as vscode from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient/node";
import * as path from 'path';
import { spawn } from 'child_process';
import process from "node:process";

let client: LanguageClient;
let outputChannel: vscode.OutputChannel;

export function activate(ctx: vscode.ExtensionContext) {
    const serverModule = ctx.asAbsolutePath(path.join('server_out.js'));
    
    const serverOpts: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: { execArgv: ['--nolazy', '--inspect=6009'] }
        }
    };

    const clientOpts: LanguageClientOptions = {
        documentSelector: [{scheme: "file", language: "noktoy"}],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher("**/.clientrc")
        }
    };

    outputChannel = vscode.window.createOutputChannel("Noktoy Result");
    ctx.subscriptions.push(outputChannel);

    ctx.subscriptions.push(vscode.commands.registerCommand("noktoy.execute", () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const doc = editor.document;
            outputChannel.clear();
            outputChannel.appendLine(`---- Executing file ---`);
            outputChannel.show(true);

            let cmd: string;
            let args: string[];

            if (process.platform == 'win32') {
                cmd = 'cmd.exe';
                args = ['/c', 'noktoy', doc.fileName];
            } else {
                cmd = 'noktoy';
                args = [doc.fileName];
            }

            const child = spawn(cmd, args, { cwd: vscode.Uri.file(doc.fileName).fsPath.substring(0, doc.fileName.lastIndexOf('/')) });
            
            child.stdout.on('data', (data) => {
                outputChannel.append(data.toString());
            });

            child.on('close', (code) => {
                if (code != 0) {
                    outputChannel.appendLine(`---- File exited with ${code} ---`);
                } else {
                    outputChannel.appendLine(`---- File exited successfully ---`);
                }
                outputChannel.show();
            });

            child.on('error', (err) => {
                outputChannel.appendLine(`Failed to start command: ${err.message}\nPlease ensure that you have Noktoy installed in your PATH and is called by 'noktoy'.`);
                vscode.window.showErrorMessage(`Error executing command: ${err.message}`);
                outputChannel.show();
            });
        } else {
            vscode.window.showWarningMessage("No file to execute");
        }
    }));

    client = new LanguageClient("noktoy", "Noktoy Server", serverOpts, clientOpts);
    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    return client ? client.stop() : undefined;
}