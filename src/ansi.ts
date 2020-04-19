type Color = string | number | undefined;

interface GenericSpan<T extends string, V> {
    type: T;
    value: V;
}
type ValueSpan = GenericSpan<"value", string>;
type ResetSpan = GenericSpan<"reset", undefined>;
type ColorSpan = GenericSpan<"color", Color>;
type BgColorSpan = GenericSpan<"bgColor", Color>;
type BoldSpan = GenericSpan<"bold", boolean>;
type DimSpan = GenericSpan<"dim", boolean>;
type ItalicSpan = GenericSpan<"italic", boolean>;
type UnderlineSpan = GenericSpan<"underline", boolean>;
type BlinkSpan = GenericSpan<"blink", boolean>;
type InverseSpan = GenericSpan<"inverse", boolean>;
type StrikeSpan = GenericSpan<"strike", boolean>;

export type Span =
    | ValueSpan
    | ResetSpan
    | ColorSpan
    | BgColorSpan
    | BoldSpan
    | DimSpan
    | ItalicSpan
    | UnderlineSpan
    | BlinkSpan
    | InverseSpan
    | StrikeSpan;

function isWhiteSpace(c: string): boolean {
    if (c === "\r") return false;
    if (c === "\n") return false;
    return /^\s$/.test(c);
}

const COLORS = [
    "black",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
];
function getColorName(code: number): string {
    if ((code >= 30 && code <= 37) || (code >= 40 && code <= 47)) {
        return COLORS[code % 10];
    } else if ((code >= 90 && code <= 97) || (code >= 100 && code <= 107)) {
        const color = COLORS[code % 10];
        return "bright" + color[1].toUpperCase() + color.substring(1);
    }
    throw new Error(`invalid color code: ${code}`);
}
function getColorCode(color: string, bg: boolean): number {
    const index = COLORS.indexOf(color);

    if (index >= 0) {
        return index + (bg ? 40 : 30);
    } else {
        throw new Error(`invalid color name ${color}`);
    }
}

type CodeState = "sgr" | "fgprefix" | "fg" | "bgprefix" | "bg";
type EscapeState = "text" | "bracket" | "code";
const ESCAPE = "\u001b";
export function parseAnsi(str: string, splitOnWord: boolean): Span[] {
    const spans: Span[] = [];
    let escapeState: EscapeState = "text";

    let codeState: CodeState = "sgr";
    let code = "";
    let value = "";

    function applyCode(): void {
        if (code.length === 0) {
            spans.push({ type: "reset", value: undefined });
            return;
        }

        const n = Number(code);

        switch (codeState) {
            case "sgr":
                if (n === 0) {
                    spans.push({ type: "reset", value: undefined });
                } else if (n === 1) {
                    spans.push({ type: "bold", value: true });
                } else if (n === 2) {
                    spans.push({ type: "dim", value: true });
                } else if (n === 3) {
                    spans.push({ type: "italic", value: true });
                } else if (n === 4) {
                    spans.push({ type: "underline", value: true });
                } else if (n === 5 || n === 6) {
                    spans.push({ type: "blink", value: true });
                } else if (n === 7) {
                    spans.push({ type: "inverse", value: true });
                } else if (n === 9) {
                    spans.push({ type: "strike", value: true });
                } else if (n === 22) {
                    spans.push({ type: "bold", value: false });
                    spans.push({ type: "dim", value: false });
                } else if (n === 23) {
                    spans.push({ type: "italic", value: false });
                } else if (n === 24) {
                    spans.push({ type: "underline", value: false });
                } else if (n === 25) {
                    spans.push({ type: "blink", value: false });
                } else if (n === 27) {
                    spans.push({ type: "inverse", value: false });
                } else if (n === 29) {
                    spans.push({ type: "strike", value: false });
                } else if ((n >= 30 && n <= 37) || (n >= 90 && n <= 97)) {
                    spans.push({ type: "color", value: getColorName(n) });
                } else if (n === 38) {
                    codeState = "fgprefix";
                } else if (n === 39) {
                    spans.push({ type: "color", value: undefined });
                } else if ((n >= 40 && n <= 47) || (n >= 100 && n <= 107)) {
                    spans.push({ type: "bgColor", value: getColorName(n) });
                } else if (n === 48) {
                    codeState = "bgprefix";
                } else if (n === 49) {
                    spans.push({ type: "bgColor", value: undefined });
                }
                break;
            case "fgprefix":
                if (n === 5) {
                    codeState = "fg";
                } else {
                    codeState = "sgr";
                }
                break;
            case "fg":
                spans.push({ type: "color", value: n });
                break;
            case "bgprefix":
                if (n === 5) {
                    codeState = "bg";
                } else {
                    codeState = "sgr";
                }
                break;
            case "bg":
                spans.push({ type: "bgColor", value: n });
                break;
        }
        code = "";
    }

    function applyValue(): void {
        if (value.length > 0) {
            spans.push({ type: "value", value });
            value = "";
        }
    }

    let whitespace = false;
    for (const c of str) {
        switch (escapeState) {
            case "text":
                if (c === ESCAPE) {
                    applyValue();
                    escapeState = "bracket";
                } else if (splitOnWord && isWhiteSpace(c)) {
                    value += c;
                    whitespace = true;
                } else if (splitOnWord && !isWhiteSpace(c) && whitespace) {
                    whitespace = false;
                    applyValue();
                    value += c;
                } else {
                    value += c;
                }
                break;
            case "bracket":
                if (c === "[") {
                    escapeState = "code";
                } else {
                    escapeState = "text";
                }
                break;
            case "code":
                if (c >= "0" && c <= "9") {
                    code += c;
                } else if (c === ";") {
                    applyCode();
                } else if (c === "m") {
                    applyCode();
                    escapeState = "text";
                }
        }
    }

    if (code.length > 0) {
        applyCode();
    }

    applyValue();

    return spans;
}

export function emitAnsi(spans: Span[]): string[] {
    const values: string[] = [];
    // start with reset code
    let currentCodes: number[] = [0];

    function emitValue(v: string): void {
        if (currentCodes.length > 0) {
            values.push("\u001b[" + currentCodes.join(";") + "m" + v);
            currentCodes = [];
        } else {
            values.push(v);
        }
    }

    function emitCode(code: number): void {
        currentCodes.push(code);
    }

    function emitColor(color: Color, bg: boolean): void {
        if (typeof color === "string") {
            const code = getColorCode(color, bg);
            currentCodes.push(code);
        } else if (typeof color === "number") {
            throw new Error("number colors are not implemented");
        } else {
            currentCodes.push(bg ? 49 : 39);
        }
    }

    for (const span of spans) {
        switch (span.type) {
            case "value":
                emitValue(span.value);
                break;
            case "reset":
                emitCode(0);
                break;
            case "color":
                emitColor(span.value, false);
                break;
            case "bgColor":
                emitColor(span.value, true);
                break;
            case "bold":
                emitCode(span.value ? 1 : 22);
                break;
            case "dim":
                emitCode(span.value ? 2 : 22);
                break;
            case "italic":
                emitCode(span.value ? 3 : 23);
                break;
            case "underline":
                emitCode(span.value ? 4 : 24);
                break;
            case "blink":
                emitCode(span.value ? 5 : 25);
                break;
            case "inverse":
                emitCode(span.value ? 7 : 27);
                break;
            case "strike":
                emitCode(span.value ? 9 : 29);
                break;
        }
    }

    return values;
}
