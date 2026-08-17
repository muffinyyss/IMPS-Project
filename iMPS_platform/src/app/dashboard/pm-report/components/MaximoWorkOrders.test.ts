import { describe, expect, it } from "vitest";
import { derivePlanningStatus } from "./MaximoWorkOrders";

describe("derivePlanningStatus", () => {
  it("marks selection as planned when equipment is chosen", () => {
    expect(derivePlanningStatus(2)).toBe("planned");
    expect(derivePlanningStatus(1, "planned")).toBe("planned");
  });

  it("keeps pending when no equipment is selected", () => {
    expect(derivePlanningStatus(0)).toBe("pending");
    expect(derivePlanningStatus(0, "pending")).toBe("pending");
  });
});
