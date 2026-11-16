import * as Font from "expo-font";

import { loadUrduFont, URDU_FONT_BOLD, URDU_FONT_REGULAR } from "./urdu-font";

jest.mock("expo-font", () => ({ loadAsync: jest.fn(() => Promise.resolve()) }));

describe("urdu font with the real package installed", () => {
  it("loads the regular and bold Nastaliq weights", async () => {
    await expect(loadUrduFont()).resolves.toBe(true);
    const arg = (Font.loadAsync as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(arg).sort()).toEqual([URDU_FONT_BOLD, URDU_FONT_REGULAR].sort());
    expect(URDU_FONT_BOLD).toBe("NotoNastaliqUrdu_700Bold");
  });
});
