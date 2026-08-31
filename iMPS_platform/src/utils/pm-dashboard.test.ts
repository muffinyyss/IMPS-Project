import { describe, expect, it } from "vitest";
import {
  PmRow,
  EMPTY_PM_FILTERS, FLEXXFAST_BRAND, UNKNOWN_BRAND, UNKNOWN_COMPANY,
  applyFilters, brandOf, bucketOf, companyOf, filterByDate, groupByMonth,
  listBrands, listCompanies, listYears, matchesCompanyFilter, originOf,
  rowDate, stageOf, weekOfMonth, weeksInMonth,
} from "./pm-dashboard";

const wo = (over: Partial<PmRow> = {}): PmRow => ({
  id: "WO-1", kind: "wo", wonum: "WO-1", pm_date: "2026-08-12",
  status: "APPR", planning_status: "pending", station_id: "Klongluang3", ...over,
});

const report = (over: Partial<PmRow> = {}): PmRow => ({
  id: "R-1", kind: "report", pm_date: "2026-08-12",
  status: "submitted", station_id: "Klongluang3", ...over,
});

describe("brandOf / companyOf", () => {
  it("normalise la casse de FlexxFast et retombe sur Unknown", () => {
    expect(brandOf(wo({ charger_brand: "flexxfast" }))).toBe(FLEXXFAST_BRAND);
    expect(brandOf(wo({ charger_brand: "  Delta " }))).toBe("Delta");
    expect(brandOf(wo({ charger_brand: "" }))).toBe(UNKNOWN_BRAND);
    expect(brandOf(wo({}))).toBe(UNKNOWN_BRAND);
  });

  it("company vide = Unknown", () => {
    expect(companyOf(wo({ company: "EGAT" }))).toBe("EGAT");
    expect(companyOf(wo({ company: "   " }))).toBe(UNKNOWN_COMPANY);
  });
});

describe("matchesCompanyFilter", () => {
  it("EDS = les lignes de marque FlexxFast, quelle que soit la company", () => {
    expect(matchesCompanyFilter(wo({ charger_brand: "FlexxFast", company: "EGAT" }), "EDS")).toBe(true);
    expect(matchesCompanyFilter(wo({ charger_brand: "Delta", company: "EDS" }), "EDS")).toBe(false);
  });
  it("autre valeur = comparaison sur la company, insensible à la casse", () => {
    expect(matchesCompanyFilter(wo({ company: "egat" }), "EGAT")).toBe(true);
    expect(matchesCompanyFilter(wo({ company: "PTG" }), "EGAT")).toBe(false);
  });
  it("filtre nul = tout passe", () => {
    expect(matchesCompanyFilter(wo({}), null)).toBe(true);
  });
});

describe("listBrands / listCompanies", () => {
  it("trie par volume et renvoie Unknown en dernier", () => {
    const rows = [
      wo({ charger_brand: "Delta" }),
      wo({ charger_brand: "FlexxFast" }),
      wo({ charger_brand: "FlexxFast" }),
      wo({ charger_brand: "" }),
    ];
    expect(listBrands(rows)).toEqual([FLEXXFAST_BRAND, "Delta", UNKNOWN_BRAND]);
  });
  it("les compagnies sont triées alphabétiquement, Unknown en dernier", () => {
    const rows = [wo({ company: "PTG" }), wo({ company: "" }), wo({ company: "EGAT" })];
    expect(listCompanies(rows)).toEqual(["EGAT", "PTG", UNKNOWN_COMPANY]);
  });
});

describe("originOf", () => {
  it("une ligne WO vient toujours de Maximo", () => {
    expect(originOf(wo())).toBe("maximo");
  });
  it("un document rattaché à un wonum reste d'origine Maximo", () => {
    expect(originOf(report({ wonum: "WO-42" }))).toBe("maximo");
  });
  it("un document sans wonum a été créé par un utilisateur", () => {
    expect(originOf(report({ wonum: "" }))).toBe("user");
    expect(originOf(report({}))).toBe("user");
  });
});

describe("stageOf", () => {
  it("WO non assignée = open, assignée = in progress", () => {
    expect(stageOf(wo({ planning_status: "pending" }))).toBe("open");
    expect(stageOf(wo({ planning_status: "planned" }))).toBe("in_progress");
  });
  it("WO fermée dans Maximo = closed", () => {
    expect(stageOf(wo({ status: "COMP" }))).toBe("closed");
    expect(stageOf(wo({ status: "closed" }))).toBe("closed");
  });
  it("WO annulée ou reprogrammée = cancelled, même assignée", () => {
    expect(stageOf(wo({ status: "CAN", planning_status: "planned" }))).toBe("cancelled");
    expect(stageOf(wo({ status: "RESCHED" }))).toBe("cancelled");
  });
  it("documents PM : draft / wait for approve / closed", () => {
    expect(stageOf(report({ status: "draft" }))).toBe("in_progress");
    expect(stageOf(report({ status: "Wait for approve" }))).toBe("wait_approve");
    expect(stageOf(report({ status: "Closed" }))).toBe("closed");
    // ใบเก่าไม่มี status = ปิดไปแล้วก่อนมี flow อนุมัติ
    expect(stageOf(report({ status: "" }))).toBe("closed");
  });
  it("reconnaît l'annulation écrite en thaï", () => {
    expect(stageOf(report({ status: "ยกเลิก" }))).toBe("cancelled");
    expect(stageOf(report({ status: "เลื่อนแผน" }))).toBe("cancelled");
  });
});

describe("bucketOf", () => {
  it("les 3 buckets couvrent toutes les étapes", () => {
    expect(bucketOf(report({ status: "Closed" }))).toBe("completed");
    expect(bucketOf(report({ status: "draft" }))).toBe("not_completed");
    expect(bucketOf(report({ status: "Wait for approve" }))).toBe("not_completed");
    expect(bucketOf(wo({ planning_status: "pending" }))).toBe("not_completed");
    expect(bucketOf(wo({ status: "CAN" }))).toBe("cancelled");
  });

  it("les 3 buckets font exactement le total (invariant des 4 cartes)", () => {
    const rows = [
      report({ status: "Closed" }), report({ status: "submitted" }),
      report({ status: "draft" }), report({ status: "Wait for approve" }),
      wo({ planning_status: "pending" }), wo({ status: "CAN" }),
    ];
    const counts = { completed: 0, not_completed: 0, cancelled: 0 };
    for (const r of rows) counts[bucketOf(r)]++;
    expect(counts).toEqual({ completed: 2, not_completed: 3, cancelled: 1 });
    expect(counts.completed + counts.not_completed + counts.cancelled).toBe(rows.length);
  });
});

describe("rowDate", () => {
  it("lit une date « YYYY-MM-DD » en heure locale (pas de décalage de jour)", () => {
    const d = rowDate(report({ pm_date: "2026-08-01" }))!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(1);
  });
  it("retourne null quand la date manque", () => {
    expect(rowDate(report({ pm_date: "" }))).toBeNull();
    expect(rowDate(report({ pm_date: "-" }))).toBeNull();
    expect(rowDate(report({ pm_date: undefined }))).toBeNull();
    expect(rowDate(report({ pm_date: "pas une date" }))).toBeNull();
  });
});

describe("weekOfMonth / weeksInMonth", () => {
  it("la semaine 1 est celle qui contient le 1er du mois (semaine à lundi)", () => {
    // 1er août 2026 = samedi → 1er au 2 août = semaine 1
    expect(weekOfMonth(new Date(2026, 7, 1))).toBe(1);
    expect(weekOfMonth(new Date(2026, 7, 2))).toBe(1);
    expect(weekOfMonth(new Date(2026, 7, 3))).toBe(2);
  });
  it("compte les semaines du mois", () => {
    expect(weeksInMonth(2026, 7)).toBe(6); // août 2026 déborde sur 6 semaines
    expect(weeksInMonth(2026, 1)).toBe(5); // février 2026
  });
});

describe("listYears", () => {
  it("inclut toujours l'année en cours et trie du plus récent au plus ancien", () => {
    const current = new Date().getFullYear();
    const years = listYears([report({ pm_date: "2024-03-01" }), report({ pm_date: "2025-01-01" })]);
    expect(years).toContain(current);
    expect(years).toContain(2024);
    expect(years).toContain(2025);
    expect([...years].sort((a, b) => b - a)).toEqual(years);
  });
});

describe("filterByDate", () => {
  const rows = [
    report({ id: "a", pm_date: "2026-08-01" }),
    report({ id: "b", pm_date: "2026-08-20" }),
    report({ id: "c", pm_date: "2025-08-20" }),
    report({ id: "d", pm_date: "" }),
  ];

  it("filtre par année", () => {
    expect(filterByDate(rows, 2026, "all", "all").map((r) => r.id)).toEqual(["a", "b"]);
  });
  it("filtre par mois", () => {
    expect(filterByDate(rows, 2026, 7, "all").map((r) => r.id)).toEqual(["a", "b"]);
    expect(filterByDate(rows, 2026, 0, "all")).toEqual([]);
  });
  it("la semaine ne s'applique qu'avec un mois choisi", () => {
    expect(filterByDate(rows, 2026, 7, 1).map((r) => r.id)).toEqual(["a"]);
    expect(filterByDate(rows, 2026, "all", 1).map((r) => r.id)).toEqual(["a", "b"]);
  });
  it("les lignes sans date ne sortent que sans filtre d'année", () => {
    expect(filterByDate(rows, "all", "all", "all").map((r) => r.id)).toContain("d");
    expect(filterByDate(rows, 2026, "all", "all").map((r) => r.id)).not.toContain("d");
  });
});

describe("groupByMonth", () => {
  it("répartit sur 12 mois, annulés exclus, wait_approve compté en cours", () => {
    const { open, inProgress, completed } = groupByMonth([
      wo({ pm_date: "2026-01-05", planning_status: "pending" }),
      wo({ pm_date: "2026-01-06", planning_status: "planned" }),
      report({ pm_date: "2026-01-07", status: "Wait for approve" }),
      report({ pm_date: "2026-02-07", status: "Closed" }),
      wo({ pm_date: "2026-02-08", status: "CAN" }),
      report({ pm_date: "", status: "Closed" }),
    ]);
    expect(open).toHaveLength(12);
    expect(open[0]).toBe(1);
    expect(inProgress[0]).toBe(2);
    expect(completed[1]).toBe(1);
    // annulé + ligne sans date = jamais comptés
    expect(open.concat(inProgress, completed).reduce((s, v) => s + v, 0)).toBe(4);
  });
});

describe("applyFilters", () => {
  const rows = [
    report({ id: "closed-delta", status: "Closed", charger_brand: "Delta", company: "EGAT", station_name: "Klongluang" }),
    report({ id: "draft-flexx", status: "draft", charger_brand: "FlexxFast", company: "EDS", station_name: "Ratchaphruek" }),
    wo({ id: "cancelled", status: "CAN", charger_brand: "Delta", company: "EGAT", station_name: "Klongluang" }),
  ];

  it("filtre par bucket", () => {
    expect(applyFilters(rows, { ...EMPTY_PM_FILTERS, bucket: "completed" }).map((r) => r.id)).toEqual(["closed-delta"]);
    expect(applyFilters(rows, { ...EMPTY_PM_FILTERS, bucket: "cancelled" }).map((r) => r.id)).toEqual(["cancelled"]);
  });

  it("filtre par étape, marque, entreprise, station et origine", () => {
    expect(applyFilters(rows, { ...EMPTY_PM_FILTERS, stage: "in_progress" }).map((r) => r.id)).toEqual(["draft-flexx"]);
    expect(applyFilters(rows, { ...EMPTY_PM_FILTERS, brand: "delta" })).toHaveLength(2);
    expect(applyFilters(rows, { ...EMPTY_PM_FILTERS, company: "EDS" }).map((r) => r.id)).toEqual(["draft-flexx"]);
    expect(applyFilters(rows, { ...EMPTY_PM_FILTERS, station: "Klongluang" })).toHaveLength(2);
    expect(applyFilters(rows, { ...EMPTY_PM_FILTERS, origin: "user" }).map((r) => r.id)).toEqual(["closed-delta", "draft-flexx"]);
  });

  it("`exclude` neutralise une seule dimension — le contrôle qui la pose reste complet", () => {
    const filters = { ...EMPTY_PM_FILTERS, bucket: "completed" as const, brand: "Delta" };
    expect(applyFilters(rows, filters)).toHaveLength(1);
    // la rangée de cartes ignore son propre filtre : les 2 lignes Delta restent visibles
    expect(applyFilters(rows, filters, "bucket")).toHaveLength(2);
  });

  it("aucun filtre = aucune ligne perdue", () => {
    expect(applyFilters(rows, EMPTY_PM_FILTERS)).toHaveLength(rows.length);
  });
});
