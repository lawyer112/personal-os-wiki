import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ headers: vi.fn(), create: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/inbox", () => ({ createInboxItem: mocks.create }));
import { createCaptureAction } from "@/app/capture/actions";
const form = (content: string) => { const value = new FormData(); value.set("content", content); return value; };
describe("中文采集操作权限", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("PERSONAL_OS_API_TOKEN", "local-test-admin-credential"); vi.stubEnv("PERSONAL_OS_READ_TOKEN", "local-test-read-credential"); mocks.create.mockResolvedValue({ id: "capture-test" }); });
  afterEach(() => vi.unstubAllEnvs());
  it("拒绝只读会话写入", async () => {
    mocks.headers.mockResolvedValue(new Headers({ cookie: "personal_os_read=local-test-read-credential" }));
    const result = await createCaptureAction({ ok: false }, form("待整理资料"));
    expect(result.ok).toBe(false); expect(result.error).toContain("没有保存权限"); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("允许已认证管理会话保存原文", async () => {
    mocks.headers.mockResolvedValue(new Headers({ cookie: "personal_os_read=local-test-admin-credential" }));
    const result = await createCaptureAction({ ok: false }, form("这是一项新的项目想法"));
    expect(result).toMatchObject({ ok: true, itemId: "capture-test" }); expect(mocks.create).toHaveBeenCalledTimes(1); expect(mocks.revalidate).toHaveBeenCalledWith("/inbox");
  });
  it("无效输入不会进入数据库", async () => {
    mocks.headers.mockResolvedValue(new Headers({ Authorization: "Bearer local-test-admin-credential" }));
    const result = await createCaptureAction({ ok: false }, form(" "));
    expect(result.ok).toBe(false); expect(result.error).toContain("有效"); expect(mocks.create).not.toHaveBeenCalled();
  });
});
