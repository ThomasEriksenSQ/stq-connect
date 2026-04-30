import { describe, expect, it } from "vitest";

import {
  getPipelineStatusMeta,
  isOpenPipelineStatus,
  normalizePipelineStatus,
} from "@/lib/pipelineStatus";

describe("pipelineStatus", () => {
  it("normalizes unknown statuses to sendt_cv", () => {
    expect(normalizePipelineStatus("ukjent")).toBe("sendt_cv");
    expect(normalizePipelineStatus(null)).toBe("sendt_cv");
  });

  it("marks only in-progress statuses as open", () => {
    expect(isOpenPipelineStatus("sendt_cv")).toBe(true);
    expect(isOpenPipelineStatus("intervju")).toBe(true);
    expect(isOpenPipelineStatus("vunnet")).toBe(false);
    expect(isOpenPipelineStatus("avslag")).toBe(false);
    expect(isOpenPipelineStatus("bortfalt")).toBe(false);
  });

  it("returns display metadata", () => {
    expect(getPipelineStatusMeta("intervju")).toMatchObject({
      label: "Intervju",
      rank: 2,
    });
  });
});
