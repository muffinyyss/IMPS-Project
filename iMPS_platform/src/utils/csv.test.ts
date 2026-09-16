import { describe, expect, it } from "vitest";
import { csvCell, csvDate, csvFilename, toCsv } from "./csv";

describe("csvCell", () => {
  it("renvoie une cellule vide pour null / undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("laisse passer le texte simple, le thaï et les nombres", () => {
    expect(csvCell("Klongluang3")).toBe("Klongluang3");
    expect(csvCell("สถานี")).toBe("สถานี");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(0)).toBe("0");
  });

  it("entoure de guillemets et double les guillemets internes", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("neutralise les formules (CSV injection)", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+cmd")).toBe("'+cmd");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-2+3")).toBe("'-2+3");
  });

  it("ne touche ni aux nombres négatifs ni aux tirets seuls", () => {
    expect(csvCell("-12.5")).toBe("-12.5");
    expect(csvCell(-3)).toBe("-3");
    expect(csvCell("-")).toBe("-");
  });
});

describe("toCsv", () => {
  type Row = { name: string; n: number };
  const columns = [
    { header: "#", value: (_: Row, i: number) => i + 1 },
    { header: "Name", value: (r: Row) => r.name },
    { header: "Count", value: (r: Row) => r.n },
  ];

  it("écrit l'en-tête puis une ligne par élément, séparées par CRLF", () => {
    const csv = toCsv([{ name: "A", n: 1 }, { name: "B, C", n: 2 }], columns);
    expect(csv).toBe('#,Name,Count\r\n1,A,1\r\n2,"B, C",2');
  });

  it("garde l'en-tête même sans ligne", () => {
    expect(toCsv([], columns)).toBe("#,Name,Count");
  });
});

describe("csvFilename", () => {
  it("préfixe + date locale sur deux chiffres", () => {
    expect(csvFilename("pm-list", new Date(2026, 8, 4))).toBe("pm-list-2026-09-04.csv");
  });
});

describe("csvDate", () => {
  it("garde la partie date d'une chaîne YYYY-MM-DD ou ISO", () => {
    expect(csvDate("2026-08-21")).toBe("2026-08-21");
    expect(csvDate("2026-08-21T10:00:00Z")).toBe("2026-08-21");
  });

  it("renvoie vide pour les valeurs absentes ou invalides", () => {
    expect(csvDate("")).toBe("");
    expect(csvDate("-")).toBe("");
    expect(csvDate(undefined)).toBe("");
    expect(csvDate("pas une date")).toBe("");
  });
});
