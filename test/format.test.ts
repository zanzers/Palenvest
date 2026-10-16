import { describe, expect, it } from "vitest";
import { formatPeso } from "../lib/format"

describe("formatPeso", () => {
    it("formats whole peso amounts", () => {
        expect(formatPeso(25000)).toContain("25,000");
    });

    it("uses the peso sign", () => {
        expect(formatPeso(5500000)).toContain("₱");
    });
});