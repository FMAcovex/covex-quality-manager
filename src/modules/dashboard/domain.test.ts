import { describe, expect, it } from "vitest";
import { normalizeDashboardFilters, summarizeStatuses, splitTasks, trendPoints, type DashboardTask } from "./domain";

describe("D1B dashboard contracts", () => {
  it("validates selectors rather than accepting arbitrary input", () => {
    const now = new Date("2026-10-11T00:00:00Z");
    expect(normalizeDashboardFilters({module:"RETURN",year:"2025",taskView:"overdue",page:"2"},now))
      .toMatchObject({module:"RETURN",year:2025,taskView:"overdue",page:2});
    expect(normalizeDashboardFilters({module:"<script>",year:"209999",taskView:"ALL",page:"-4"},now))
      .toMatchObject({module:"DEVIATION",year:2026,taskView:"all",page:1});
  });
  it("counts each status without treating draft or cancelled as open", () => {
    expect(summarizeStatuses("CAPA",[
      {status:"OPEN",count:2},{status:"DRAFT",count:1},{status:"CLOSED",count:3},{status:"CANCELLED",count:4}
    ],"/capa")).toEqual({module:"CAPA",total:10,open:2,draft:1,closed:3,other:4,href:"/capa"});
  });
  it("preserves unknown-coverage years, even when current quantity is zero", () => {
    expect(trendPoints([{year:2024,total:0,dataAvailable:false},{year:2025,total:0,dataAvailable:true},{year:2026,total:3,openCurrent:2,dataAvailable:true}]))
      .toEqual([{year:2024,total:0,open:0,dataAvailable:false},{year:2025,total:0,open:0,dataAvailable:true},{year:2026,total:3,open:2,dataAvailable:true}]);
  });
  it("filters tasks without multiplying records and safely clamps pagination", () => {
    const items: DashboardTask[] = Array.from({length:13},(_,i)=>({key:String(i),module:"DEVIATION",businessCode:String(i),label:"Seguimiento",detail:"Prueba",href:"/deviations/"+i,dueDate:new Date(),state:i<7?"OVERDUE":"UPCOMING"}));
    const page = splitTasks(items,"all",99);
    expect(page).toMatchObject({total:13,page:2,pages:2});
    expect(page.items).toHaveLength(3);
    expect(splitTasks(items,"overdue",1).total).toBe(7);
  });
});
