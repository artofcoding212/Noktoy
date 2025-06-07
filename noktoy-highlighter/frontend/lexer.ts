import { Token, TokenLookup, TokenType } from "./token.ts";

function numeric(char: string): boolean {
    return char != undefined && /^[0-9]$/.test(char);
}

function alpha(char: string): boolean {
    return char != undefined && /[a-zA-Z_]$/.test(char);
}

function alphaNumeric(char: string): boolean {
    return char != undefined && /[a-zA-Z0-9_]$/.test(char);
}

export class Lexer {
    private src: string[];
    public ptr: number;
    public current: string;
    private line: number = 1;

    constructor(src: string){
        this.src = src.split("");
        this.ptr = 0;
        this.current = this.src[0];
    }

    private string(end: string): Token {
        let buf = '';
        const ln = this.line;

        while (this.current != end) {
            if (this.current == '\\' && this.src[this.ptr+1] == end) {
                this.ptr += 2;
                this.current = this.src[this.ptr];
                continue;
            }
            if (this.current=='\n')
                this.line++;
            buf = buf+this.src[this.ptr++];
            this.current = this.src[this.ptr];
        }

        buf = buf.replace('\\n', '\n');
        buf = buf.replace('\\t', '\t');
        buf = buf.replace('\\0', '\0');

        this.current = this.src[++this.ptr];
        return { type: TokenType.String, value: buf, ln };
    }

    public next(): Token {
        while (this.current?.match(/[\s\r\n\t#]/)) {
            if (this.current == '#')
                while (this.current as string != '\n' && this.current as string != undefined)
                    this.current = this.src[++this.ptr];
            if (this.current === '\n') this.line++;
            this.current = this.src[++this.ptr];
        }

        const ch = this.src[this.ptr++];
        const ln = this.line;
        this.current = this.src[this.ptr];

        if (ch === undefined) {
            return { type: TokenType.EOF, value: "", ln };
        }

        switch (ch) {
            case '"': return this.string('"');
            case "'": return this.string("'");
        }

        const doubleChar = ch + this.current;
        if (TokenLookup[doubleChar]) {
            this.current = this.src[++this.ptr];
            return { type: TokenLookup[doubleChar], value: doubleChar, ln };
        }

        if (TokenLookup[ch]) {
            return { type: TokenLookup[ch], value: ch, ln };
        }

        if (numeric(ch)) {
            let buf = ch;
            while (numeric(this.current)) {
                buf += this.current;
                this.current = this.src[++this.ptr];
            }
            if (this.current == '.') {
                buf += this.current;
                this.current = this.src[++this.ptr];
                while (numeric(this.current)) {
                    buf += this.current;
                    this.current = this.src[++this.ptr];
                }
            }
            return { type: TokenType.Number, value: buf, ln };
        }

        if (alpha(ch)) {
            let buf = ch;
            while (alphaNumeric(this.current)) {
                buf += this.current;
                this.current = this.src[++this.ptr];
            }
            return { type: TokenType.Id, value: buf, ln };
        }

        throw `character ${ch} is not known (line ${ln})`; 
    }
}