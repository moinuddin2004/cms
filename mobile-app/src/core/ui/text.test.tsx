import { act, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { UrduFontScope, setLocale } from "@/core/i18n";
import { loadUrduFont } from "@/core/i18n/urdu-font";

import { Text } from "./text";

jest.mock("expo-font", () => ({ loadAsync: jest.fn(() => Promise.resolve()) }));

const styleOf = (node: { props: { style?: unknown } }) =>
  JSON.stringify(node.props.style ?? null);

describe("Text with the Urdu font", () => {
  beforeAll(async () => {
    await act(async () => {
      await loadUrduFont();
    });
  });
  beforeEach(() => setLocale("ur"));
  afterEach(async () => {
    await act(async () => setLocale(null));
  });

  it("leaves Text outside the patient scope (staff) alone", async () => {
    await render(<Text>hello</Text>);
    expect(styleOf(screen.getByText("hello"))).not.toContain("Nastaliq");
  });

  it("applies the font in scope and keeps a caller style", async () => {
    await render(
      <UrduFontScope>
        <Text style={{ color: "red" }} variant="large">
          hi
        </Text>
      </UrduFontScope>,
    );
    const style = styleOf(screen.getByText("hi"));
    expect(style).toContain("NotoNastaliqUrdu_700Bold");
    expect(style).toContain('"color":"red"');
  });
});
