import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { SkeletonCard, SkeletonList, SkeletonStat, SkeletonTable } from "./index";

describe("skeleton variants", () => {
  it("SkeletonList renders requested rows", () => {
    const { container } = render(<SkeletonList rows={3} />);
    const list = container.querySelector("[data-testid='skeleton-list']");
    expect(list?.children).toHaveLength(3);
  });

  it("SkeletonCard renders 3 skeleton lines", () => {
    const { container } = render(<SkeletonCard />);
    const card = container.querySelector("[data-testid='skeleton-card']");
    expect(card?.children).toHaveLength(3);
  });

  it("SkeletonTable renders rows × cols skeletons", () => {
    const { container } = render(<SkeletonTable rows={2} cols={4} />);
    const table = container.querySelector("[data-testid='skeleton-table']");
    expect(table?.children).toHaveLength(2);
    const firstRow = table?.children[0];
    expect(firstRow?.children).toHaveLength(4);
  });

  it("SkeletonStat renders 2 skeleton lines", () => {
    const { container } = render(<SkeletonStat />);
    const stat = container.querySelector("[data-testid='skeleton-stat']");
    expect(stat?.children).toHaveLength(2);
  });
});
