import chalk from "chalk";
import { tostring, Value } from "./shared/values.ts";
import { Interpreter } from "./backend/interpreter.ts";
import { Parser } from "./frontend/parser.ts";
import { Lexer } from "./frontend/lexer.ts";

async function repl(){
    const i = new Interpreter([], "./");
    while(true){
        const msg = prompt('> ');
        if(msg==null){
            continue;
        }
        try {
            const start = performance.now();
            i.ast = new Parser(new Lexer(msg)).parse();
            const val = await i.eval();
            const t = performance.now()-start;
            console.log(chalk.gray('Exited with ')+tostring(val, i)+chalk.gray(' in ')+chalk.bgGray(`${
                t>1000 ? `${t/1000}s` : `${Math.floor(t*100)/100}ms`
            }`));
        } catch (e) {
            if (e != null && typeof e == 'object' && 'type' in e) {
                console.log(chalk.red('RUNTIME EXCEPTION: ')+tostring(e as Value, i));
            } else {
                console.log(chalk.red('EXCEPTION: ')+e);
            }
        }
    }
}

if (Deno.args.length==0) {
    await repl();
} else if (Deno.args.length==1) {
    const i = new Interpreter([], Deno.args[0]);
    try {
        i.ast = new Parser(new Lexer(Deno.readTextFileSync(Deno.args[0]))).parse();
        await i.eval();
    } catch (e) {
        if (e != null && typeof e == 'object' && 'type' in e) {
            console.log(chalk.red('RUNTIME EXCEPTION: ')+tostring(e as Value, i));
        } else {
            console.log(chalk.red('EXCEPTION: ')+e);
        }
    }
} else {
    console.log('usage:\n\tnoktoy        | opens a REPL\n\tnoktoy [file] | executes the file');
}