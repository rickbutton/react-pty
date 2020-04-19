import { emitAnsi, parseAnsi, Span } from "../ansi";

function value(v: string): Span {
    return { type: "value", value: v };
}

describe("parseAnsi", () => {
    function p(str: string, splitOnWord: boolean): Span[] {
        return parseAnsi(str.replace(/ESC/g, "\u001b"), splitOnWord);
    }

    describe("simple text", () => {
        it("should parse a simple string", () => {
            expect(p("hello world", false)).toStrictEqual([
                value("hello world"),
            ]);
        });

        it("should parse a simple string of words", () => {
            expect(p("hello world", true)).toStrictEqual([
                value("hello "),
                value("world"),
            ]);
        });

        it("should split on the end of a series of whitespace", () => {
            expect(p("hello \t world", true)).toStrictEqual([
                value("hello \t "),
                value("world"),
            ]);
        });
    });

    describe("color", () => {
        it("should parse a string of text with color", () => {
            expect(p("ESC[31mhello world", true)).toStrictEqual([
                { type: "color", value: "red" },
                value("hello "),
                value("world"),
            ]);
        });

        it("should reset a color", () => {
            expect(p("ESC[31mhello ESC[0mworld", true)).toStrictEqual([
                { type: "color", value: "red" },
                value("hello "),
                { type: "reset", value: undefined },
                value("world"),
            ]);
        });

        it("should reset with an empty escape", () => {
            expect(p("ESC[31mhello ESC[mworld", true)).toStrictEqual([
                { type: "color", value: "red" },
                value("hello "),
                { type: "reset", value: undefined },
                value("world"),
            ]);
        });

        it("should parse a string of text with color and bg", () => {
            expect(p("ESC[31;41mhello world", false)).toStrictEqual([
                { type: "color", value: "red" },
                { type: "bgColor", value: "red" },
                value("hello world"),
            ]);
        });

        it("should parse a string of text with color and bg", () => {
            expect(p("ESC[31mESC[41mESC[1mhello world", false)).toStrictEqual([
                { type: "color", value: "red" },
                { type: "bgColor", value: "red" },
                { type: "bold", value: true },
                value("hello world"),
            ]);
        });

        it("should reset after colors", () => {
            expect(p("ESC[31;41;1mhelloESC[0mworld", false)).toStrictEqual([
                { type: "color", value: "red" },
                { type: "bgColor", value: "red" },
                { type: "bold", value: true },
                value("hello"),
                { type: "reset", value: undefined },
                value("world"),
            ]);
        });
    });

    describe("attrs", () => {
        it("should correctly set attrs for each SGR code", () => {
            interface AttrMap {
                [key: string]: Span | Span[];
            }
            const attrs: AttrMap = {
                "1": { type: "bold", value: true },
                "2": { type: "dim", value: true },
                "22": [
                    { type: "bold", value: false },
                    { type: "dim", value: false },
                ],
                "3": { type: "italic", value: true },
                "23": { type: "italic", value: false },
                "4": { type: "underline", value: true },
                "24": { type: "underline", value: false },
                "5": { type: "blink", value: true },
                "6": { type: "blink", value: true },
                "25": { type: "blink", value: false },
                "7": { type: "inverse", value: true },
                "27": { type: "inverse", value: false },
                "9": { type: "strike", value: true },
                "29": { type: "strike", value: false },
            };

            interface Map {
                [key: string]: Partial<Span>;
            }
            const colors: Map = {
                "30": { type: "color", value: "black" },
                "31": { type: "color", value: "red" },
                "32": { type: "color", value: "green" },
                "33": { type: "color", value: "yellow" },
                "34": { type: "color", value: "blue" },
                "35": { type: "color", value: "magenta" },
                "36": { type: "color", value: "cyan" },
                "37": { type: "color", value: "white" },
                "40": { type: "bgColor", value: "black" },
                "41": { type: "bgColor", value: "red" },
                "42": { type: "bgColor", value: "green" },
                "43": { type: "bgColor", value: "yellow" },
                "44": { type: "bgColor", value: "blue" },
                "45": { type: "bgColor", value: "magenta" },
                "46": { type: "bgColor", value: "cyan" },
                "47": { type: "bgColor", value: "white" },
                // TODO: 38, 48
            };

            for (const [code, attrSpan] of Object.entries(attrs)) {
                const input = `ESC[${code}`;
                const spans = Array.isArray(attrSpan) ? attrSpan : [attrSpan];
                expect(p(input, false)).toStrictEqual(spans);
            }

            for (const [code, span] of Object.entries(colors)) {
                const input = `ESC[${code}`;
                expect(p(input, false)).toStrictEqual([span]);
            }
        });
    });
});

describe("emitAnsi", () => {
    function e(s: Span | Span[]): string[] {
        const output = emitAnsi(Array.isArray(s) ? s : [s]);
        return output.map(s => s.replace(/\u001b/g, "ESC"));
    }

    describe("simple text", () => {
        it("should emit simple text", () => {
            expect(e({ type: "value", value: "hello world" })).toStrictEqual([
                "ESC[0mhello world",
            ]);
        });
        it("should emit simple text in multiple spans", () => {
            expect(
                e([
                    { type: "value", value: "hello " },
                    { type: "value", value: "world" },
                ]),
            ).toStrictEqual(["ESC[0mhello ", "world"]);
        });
        it("should not emit trailing codes", () => {
            expect(
                e([
                    { type: "value", value: "hello " },
                    { type: "value", value: "world" },
                    { type: "color", value: "red" },
                ]),
            ).toStrictEqual(["ESC[0mhello ", "world"]);
        });
    });

    describe("code breaks", () => {
        it("should emit new strings when values break codes", () => {
            expect(
                e([
                    { type: "color", value: "red" },
                    { type: "bgColor", value: "red" },
                    { type: "bold", value: true },
                    { type: "value", value: "test" },
                ]),
            ).toStrictEqual(["ESC[0;31;41;1mtest"]);
        });
    });

    describe("attrs", () => {
        type AttrTest = [Span, number];
        type AttrTests = AttrTest[];
        const attrs: AttrTests = [
            [{ type: "bold", value: true }, 1],
            [{ type: "dim", value: true }, 2],
            [{ type: "bold", value: false }, 22],
            [{ type: "dim", value: false }, 22],
            [{ type: "italic", value: true }, 3],
            [{ type: "italic", value: false }, 23],
            [{ type: "underline", value: true }, 4],
            [{ type: "underline", value: false }, 24],
            [{ type: "blink", value: true }, 5],
            [{ type: "blink", value: false }, 25],
            [{ type: "inverse", value: true }, 7],
            [{ type: "inverse", value: false }, 27],
            [{ type: "strike", value: true }, 9],
            [{ type: "strike", value: false }, 29],
        ];

        for (const [span, code] of attrs) {
            expect(e([span, { type: "value", value: "text" }])).toStrictEqual([
                `ESC[0;${code}mtext`,
            ]);
        }
    });

    describe("colors", () => {
        it("should emit colors correctly", () => {
            // TODO: 38, 48

            const colors = {
                black: 30,
                red: 31,
                green: 32,
                yellow: 33,
                blue: 34,
                magenta: 35,
                cyan: 36,
                white: 37,
            } as const;

            for (const [name, code] of Object.entries(colors)) {
                expect(
                    e([
                        { type: "color", value: name },
                        { type: "value", value: "text" },
                    ]),
                ).toStrictEqual([`ESC[0;${code}mtext`]);

                expect(
                    e([
                        { type: "bgColor", value: name },
                        { type: "value", value: "text" },
                    ]),
                ).toStrictEqual([`ESC[0;${code + 10}mtext`]);
            }
        });
    });
});
