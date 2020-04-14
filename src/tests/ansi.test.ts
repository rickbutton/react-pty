import { parseAnsi, Span } from "../ansi";

function simpleSpan(value: string, options?: Partial<Span>): Span {
    return Object.assign(
        {
            value,
            color: undefined,
            bgColor: undefined,
            bold: false,
            dim: false,
            italic: false,
            underline: false,
            blink: false,
            inverse: false,
            strike: false,
        },
        options || {},
    );
}

describe("parseAnsi", () => {
    function p(str: string, splitOnWord: boolean): string {
        return parseAnsi(str.replace(/ESC/g, "\u001b"), splitOnWord);
    }

    describe("simple text", () => {
        it("should parse a simple string", () => {
            expect(p("hello world", false)).toStrictEqual([
                simpleSpan("hello world"),
            ]);
        });

        it("should parse a simple string of words", () => {
            expect(p("hello world", true)).toStrictEqual([
                simpleSpan("hello "),
                simpleSpan("world"),
            ]);
        });

        it("should split on the end of a series of whitespace", () => {
            expect(p("hello \t world", true)).toStrictEqual([
                simpleSpan("hello \t "),
                simpleSpan("world"),
            ]);
        });
    });

    describe("color", () => {
        it("should parse a string of text with color", () => {
            expect(p("ESC[31mhello world", true)).toStrictEqual([
                simpleSpan("hello ", { color: "red" }),
                simpleSpan("world", { color: "red" }),
            ]);
        });

        it("should reset a color", () => {
            expect(p("ESC[31mhello ESC[0mworld", true)).toStrictEqual([
                simpleSpan("hello ", { color: "red" }),
                simpleSpan("world"),
            ]);
        });

        it("should reset with an empty escape", () => {
            expect(p("ESC[31mhello ESC[mworld", true)).toStrictEqual([
                simpleSpan("hello ", { color: "red" }),
                simpleSpan("world"),
            ]);
        });

        it("should parse a string of text with color and bg", () => {
            expect(p("ESC[31;41mhello world", false)).toStrictEqual([
                simpleSpan("hello world", { color: "red", bgColor: "red" }),
            ]);
        });

        it("should parse a string of text with color and bg", () => {
            expect(p("ESC[31mESC[41mESC[1mhello world", false)).toStrictEqual([
                simpleSpan("hello world", {
                    color: "red",
                    bgColor: "red",
                    bold: true,
                }),
            ]);
        });

        it("should reset color and bg", () => {
            expect(p("ESC[31;41;1mhelloESC[0mworld", false)).toStrictEqual([
                simpleSpan("hello", {
                    color: "red",
                    bgColor: "red",
                    bold: true,
                }),
                simpleSpan("world"),
            ]);
        });
    });

    describe("spans", () => {
        it("should retain past spans attributes between spans", () => {
            expect(
                p("ESC[31mhelloESC[41mworldESC[1mbold", false),
            ).toStrictEqual([
                simpleSpan("hello", { color: "red" }),
                simpleSpan("world", { color: "red", bgColor: "red" }),
                simpleSpan("bold", {
                    color: "red",
                    bgColor: "red",
                    bold: true,
                }),
            ]);
        });
    });

    describe("attrs", () => {
        it("should correctly set attrs for each SGR code", () => {
            interface AttrMap {
                [key: string]: [Partial<Span>, string, Partial<Span>];
            }
            const attrs: AttrMap = {
                "1": [{ bold: true }, "22", { bold: false }],
                "2": [{ dim: true }, "22", { dim: false }],
                "3": [{ italic: true }, "23", { italic: false }],
                "4": [{ underline: true }, "24", { underline: false }],
                "5": [{ blink: true }, "25", { blink: false }],
                "6": [{ blink: true }, "25", { blink: false }],
                "7": [{ inverse: true }, "27", { inverse: false }],
                "9": [{ strike: true }, "29", { strike: false }],
            };

            interface Map {
                [key: string]: Partial<Span>;
            }
            const colors: Map = {
                "30": { color: "black" },
                "31": { color: "red" },
                "32": { color: "green" },
                "33": { color: "yellow" },
                "34": { color: "blue" },
                "35": { color: "magenta" },
                "36": { color: "cyan" },
                "37": { color: "white" },
                // TODO: 38
            };

            const bgs: Map = {
                "40": { bgColor: "black" },
                "41": { bgColor: "red" },
                "42": { bgColor: "green" },
                "43": { bgColor: "yellow" },
                "44": { bgColor: "blue" },
                "45": { bgColor: "magenta" },
                "46": { bgColor: "cyan" },
                "47": { bgColor: "white" },
                // TODO: 48
            };

            for (const [onCode, [onAttrs, offCode, offAttrs]] of Object.entries(
                attrs,
            )) {
                const input = `ESC[${onCode}monESC[${offCode}moff`;
                expect(p(input, false)).toStrictEqual([
                    simpleSpan("on", onAttrs),
                    simpleSpan("off", offAttrs),
                ]);
            }

            for (const [code, attrs] of Object.entries(colors)) {
                const input = `ESC[${code}mcolor!ESC[39moff!`;
                expect(p(input, false)).toStrictEqual([
                    simpleSpan("color!", attrs),
                    simpleSpan("off!"),
                ]);
            }

            for (const [code, attrs] of Object.entries(bgs)) {
                const input = `ESC[${code}mbg!ESC[49moff!`;
                expect(p(input, false)).toStrictEqual([
                    simpleSpan("bg!", attrs),
                    simpleSpan("off!"),
                ]);
            }
        });
    });
});
