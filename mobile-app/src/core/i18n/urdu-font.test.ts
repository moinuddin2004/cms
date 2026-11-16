import { loadUrduFont, __resetUrduFontForTests } from "./urdu-font";

jest.mock(
  "@expo-google-fonts/noto-nastaliq-urdu",
  () => {
    throw new Error("not installed");
  },
  { virtual: true },
);
jest.mock("expo-font", () => ({ loadAsync: jest.fn(() => Promise.resolve()) }));

describe("urdu font", () => {
  beforeEach(() => __resetUrduFontForTests());

  it("falls back to the system font while the font package is not installed", async () => {
    await expect(loadUrduFont()).resolves.toBe(false);
  });
});
