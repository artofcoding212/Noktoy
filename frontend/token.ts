export enum TokenType {
    // paired operators
    Plus="Plus",
    PlusPlus="PlusPlus",
    PlusEquals="PlusEquals",
    Minus="Minus",
    MinusMinus="MinusMinus",
    MinusEquals="MinusEquals",
    Star="Star",
    StarEquals="StarEquals",
    Slash="Slash",
    SlashEquals="SlashEquals",
    Caret="Caret",
    CaretEquals="CaretEquals",
    Percent="Percent",
    PercentEquals="PercentEquals",
    LeftParen="LeftParen",
    RightParen="RightParen",
    LeftBrack="LeftBrack",
    RightBrack="RightBrack",
    LeftBrace="LeftBrace",
    RightBrace="RightBrace",
    Pipe="Pipe",
    Equals="Equals",
    Colon="Colon",
    Dot="Dot",
    ColonColon="ColonColon",
    Greater="Greater",
    GreaterEquals="GreaterEquals",
    Less="Less",
    LessEquals="LessEquals",
    EqualsEquals="EqualsEquals",
    NotEquals="NotEquals",
    Not="Not",
    Arrow="Arrow",
    Or="Or",
    And="And",
    Ampersand="Ampersand",
    DotDot="DotDot",
    Question="Question",
    QuestionQuestion="QuestionQuestion",
    LeftShift="LeftShift",
    RightShift="RightShift",

    // non-paired operators
    Comma="Comma",
    Semicolon="Semicolon",

    // misc
    EOF="EOF",
    Id="Id",
    String="String",
    Number="Number",
}

export interface Token {
    type: TokenType;
    value: string;
    ln: number;
}

export const TokenLookup: Record<string, TokenType> = {
    "+": TokenType.Plus,
    "++": TokenType.PlusPlus,
    "+=": TokenType.PlusEquals,
    "-": TokenType.Minus,
    "--": TokenType.MinusMinus,
    "-=": TokenType.MinusEquals,
    "*": TokenType.Star,
    "*=": TokenType.StarEquals,
    "/": TokenType.Slash,
    "/=": TokenType.SlashEquals,
    "^": TokenType.Caret,
    "^=": TokenType.CaretEquals,
    "%": TokenType.Percent,
    "%=": TokenType.PercentEquals,
    "(": TokenType.LeftParen,
    ")": TokenType.RightParen,
    "[": TokenType.LeftBrack,
    "]": TokenType.RightBrack,
    "{": TokenType.LeftBrace,
    "}": TokenType.RightBrace,
    ",": TokenType.Comma,
    ":": TokenType.Colon,
    "::": TokenType.ColonColon,
    ".": TokenType.Dot,
    "|": TokenType.Pipe,
    "=": TokenType.Equals,
    ">": TokenType.Greater,
    ">=": TokenType.GreaterEquals,
    "<": TokenType.Less,
    "<=": TokenType.LessEquals,
    "==": TokenType.EqualsEquals,
    "!=": TokenType.NotEquals,
    "!": TokenType.Not,
    "->": TokenType.Arrow,
    "||": TokenType.Or,
    ">>": TokenType.RightShift,
    "<<": TokenType.LeftShift,
    "&&": TokenType.And,
    "&": TokenType.Ampersand,
    "..": TokenType.DotDot,
    "?": TokenType.Question,
    "??": TokenType.QuestionQuestion,
    ";": TokenType.Semicolon,
}