import { describe, expect, it } from "vitest";
import { pendingAuditReviewDate } from "./followup-review";
const date = (s: string) => new Date(s+"T00:00:00.000Z");
describe("audit next review by latest active scope",()=>{
  it("does not hide a finding review after a later undated general followup",()=>{
    expect(pendingAuditReviewDate([{findingId:null,nextReviewDate:null},{findingId:"obs",nextReviewDate:date("2094-07-01")}],new Set(["obs"]))).toEqual(date("2094-07-01"));
  });
  it("later blank clears only its own finding, not another",()=>{
    expect(pendingAuditReviewDate([{findingId:"a",nextReviewDate:null},{findingId:"a",nextReviewDate:date("2094-06-01")},{findingId:"b",nextReviewDate:date("2094-07-01")}],new Set(["a","b"]))).toEqual(date("2094-07-01"));
  });
  it("ignores retired findings and takes earliest active review",()=>{
    expect(pendingAuditReviewDate([{findingId:"old",nextReviewDate:date("2094-05-01")},{findingId:"a",nextReviewDate:date("2094-06-01")},{findingId:null,nextReviewDate:date("2094-08-01")}],new Set(["a"]))).toEqual(date("2094-06-01"));
  });
  it("returns null for resolved scopes",()=>expect(pendingAuditReviewDate([{findingId:null,nextReviewDate:null},{findingId:"old",nextReviewDate:date("2094-05-01")}],new Set())).toBeNull());
});
