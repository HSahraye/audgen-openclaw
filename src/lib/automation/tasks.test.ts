import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  taskCreate: vi.fn(),
  taskUpdateMany: vi.fn(),
}));

vi.mock("@prisma/client", () => ({ TaskStatus: { todo: "todo", in_progress: "in_progress", done: "done", canceled: "canceled" } }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: { create: mocks.taskCreate, updateMany: mocks.taskUpdateMany },
  },
}));

import { createTask, completeTask } from "./tasks";

describe("createTask", () => {
  beforeEach(() => mocks.taskCreate.mockReset());

  it("writes the full happy-path row with explicit fields", async () => {
    mocks.taskCreate.mockResolvedValue({ id: "task_1" });
    const due = new Date("2026-06-01T10:00:00Z");
    await createTask({
      workspaceId: "ws_1",
      leadId: "lead_1",
      title: "Follow up next week",
      description: "Send a recap email",
      status: "in_progress",
      dueAt: due,
      assignedToUserId: "user_42",
      source: "wizard",
      metadata: { foo: "bar" },
    });
    const data = mocks.taskCreate.mock.calls[0][0].data;
    expect(data).toEqual({
      workspaceId: "ws_1",
      leadId: "lead_1",
      title: "Follow up next week",
      description: "Send a recap email",
      status: "in_progress",
      dueAt: due,
      assignedToUserId: "user_42",
      source: "wizard",
      metadataJson: '{"foo":"bar"}',
    });
  });

  it("defaults status to 'todo' and source to 'manual'", async () => {
    mocks.taskCreate.mockResolvedValue({ id: "task_2" });
    await createTask({ workspaceId: "ws_1", title: "Untitled" });
    const data = mocks.taskCreate.mock.calls[0][0].data;
    expect(data.status).toBe("todo");
    expect(data.source).toBe("manual");
  });

  it("coerces missing optional fields to null", async () => {
    mocks.taskCreate.mockResolvedValue({ id: "task_3" });
    await createTask({ workspaceId: "ws_1", title: "Bare task" });
    const data = mocks.taskCreate.mock.calls[0][0].data;
    expect(data.leadId).toBe(null);
    expect(data.description).toBe(null);
    expect(data.dueAt).toBe(null);
    expect(data.assignedToUserId).toBe(null);
    expect(data.metadataJson).toBe(null);
  });

  it("serializes metadata to JSON exactly when provided", async () => {
    mocks.taskCreate.mockResolvedValue({ id: "task_4" });
    await createTask({
      workspaceId: "ws_1",
      title: "With meta",
      metadata: { count: 3, nested: { a: true } },
    });
    expect(mocks.taskCreate.mock.calls[0][0].data.metadataJson).toBe(
      '{"count":3,"nested":{"a":true}}',
    );
  });
});

describe("completeTask", () => {
  beforeEach(() => mocks.taskUpdateMany.mockReset());

  it("updates the task row scoped to workspace + id with status='done'", async () => {
    mocks.taskUpdateMany.mockResolvedValue({ count: 1 });
    const res = await completeTask("task_99", "ws_1");
    expect(mocks.taskUpdateMany).toHaveBeenCalledWith({
      where: { id: "task_99", workspaceId: "ws_1" },
      data: { status: "done" },
    });
    expect(res.count).toBe(1);
  });

  it("returns count=0 when no row matches (no cross-tenant leak)", async () => {
    mocks.taskUpdateMany.mockResolvedValue({ count: 0 });
    const res = await completeTask("task_99", "ws_other");
    expect(res.count).toBe(0);
  });
});
