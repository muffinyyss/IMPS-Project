import { describe, expect, it } from "vitest";
import { bucketOf, filterByDate, originOf, stageOf } from "./pm-dashboard";
import { testPdfHref, toTestRow } from "./test-dashboard";

const API = "http://localhost:8000";

describe("toTestRow", () => {
  it("renomme test_date / test_type vers les champs lus par les helpers PM", () => {
    const row = toTestRow({
      id: "abc", test_type: "ac", test_date: "2026-08-21", status: "submitted",
      technician: "Somchai", sn: "F1", station_id: "S1", station_name: "Station 1",
      company: "EGAT", charger_brand: "FlexxFast", file_url: "/pdf/ac/x/export",
    });
    expect(row.pm_type).toBe("AC");
    expect(row.pm_date).toBe("2026-08-21");
    expect(row.kind).toBe("report");
    expect(row.source).toBe("report");
    expect(row.technician).toBe("Somchai");
  });

  it("remplace les « - » du backend par du vide et défaut DC pour un type inconnu", () => {
    const row = toTestRow({ id: "1", test_type: "", technician: "-", sn: "-", station_name: "-", source: "upload" });
    expect(row.pm_type).toBe("DC");
    expect(row.technician).toBe("");
    expect(row.sn).toBe("");
    expect(row.station_name).toBe("");
    expect(row.source).toBe("upload");
  });

  it("n'est jamais compté comme venant de Maximo", () => {
    expect(originOf(toTestRow({ id: "1" }))).toBe("user");
  });
});

describe("étapes d'un test (helpers PM partagés)", () => {
  const at = (status?: string) => toTestRow({ id: "1", status, test_date: "2026-08-01" });

  it("submitted ou sans statut = terminé", () => {
    expect(stageOf(at("submitted"))).toBe("closed");
    expect(stageOf(at(""))).toBe("closed");
    expect(bucketOf(at("submitted"))).toBe("completed");
  });

  it("draft = en cours, wait for approve = en attente d'approbation", () => {
    expect(stageOf(at("draft"))).toBe("in_progress");
    expect(stageOf(at("Wait for approve"))).toBe("wait_approve");
    expect(bucketOf(at("draft"))).toBe("not_completed");
  });

  it("annulé compte dans le bucket cancelled", () => {
    expect(bucketOf(at("cancelled"))).toBe("cancelled");
  });

  it("le filtre de date lit test_date", () => {
    const rows = [toTestRow({ id: "a", test_date: "2026-08-10" }), toTestRow({ id: "b", test_date: "2025-01-10" })];
    expect(filterByDate(rows, 2026, 7, "all").map((r) => r.id)).toEqual(["a"]);
  });
});

describe("testPdfHref", () => {
  it("vide si pas de fichier", () => {
    expect(testPdfHref("", API, "th")).toBe("");
    expect(testPdfHref(undefined, API, "th")).toBe("");
  });

  it("ajoute lang et dl=0 au PDF généré", () => {
    const href = testPdfHref("/pdf/dc/0123456789abcdef01234567/export?sn=F1", API, "en");
    const url = new URL(href);
    expect(url.pathname).toBe("/pdf/dc/0123456789abcdef01234567/export");
    expect(url.searchParams.get("sn")).toBe("F1");
    expect(url.searchParams.get("lang")).toBe("en");
    expect(url.searchParams.get("dl")).toBe("0");
  });

  it("laisse tel quel un PDF téléversé, en le rendant absolu", () => {
    expect(testPdfHref("/uploads/dcurl/F1/2026-08-01/a.pdf", API, "th"))
      .toBe("http://localhost:8000/uploads/dcurl/F1/2026-08-01/a.pdf");
    expect(testPdfHref("https://cdn.example/a.pdf", API, "th")).toBe("https://cdn.example/a.pdf");
  });
});
