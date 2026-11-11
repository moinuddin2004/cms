import { render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { FormInput } from "@/core/components/forms/FormInput";

import { FormSheet } from "./FormSheet";

// The real sheet needs native gesture/reanimated runtime; this stand-in renders the
// content and tags the library's text input so the test can tell it from a plain one.
jest.mock("@gorhom/bottom-sheet", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const RN = jest.requireActual<typeof import("react-native")>("react-native");
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    BottomSheetModal: React.forwardRef(function MockModal(
      {
        children,
        footerComponent: Footer,
      }: { children?: ReactNode; footerComponent?: React.ComponentType },
      _ref,
    ) {
      return (
        <>
          {children}
          {Footer ? <Footer /> : null}
        </>
      );
    }),
    BottomSheetScrollView: Pass,
    BottomSheetView: Pass,
    BottomSheetFooter: Pass,
    BottomSheetBackdrop: Pass,
    BottomSheetTextInput: (props: object) => (
      <RN.TextInput testID="sheet-input" {...props} />
    ),
  };
});

jest.mock("react-native-reanimated", () => {
  const { View } =
    jest.requireActual<typeof import("react-native")>("react-native");
  return { __esModule: true, default: { View } };
});
jest.mock("./ConfirmDialog", () => ({ ConfirmDialog: () => null }));

const discard = {
  title: "d",
  description: "d",
  confirmLabel: "ok",
  cancelLabel: "no",
};

describe("FormInput inside FormSheet", () => {
  it("renders the bottom-sheet text input so the sheet follows the keyboard", async () => {
    await render(
      <FormSheet
        open
        onClose={jest.fn()}
        title="New"
        discard={discard}
        closeLabel="Close"
      >
        <FormInput accessibilityLabel="Name" />
      </FormSheet>,
    );
    expect(screen.getByTestId("sheet-input")).toBeTruthy();
  });

  it("renders a plain input outside a sheet", async () => {
    await render(<FormInput accessibilityLabel="Name" />);
    expect(screen.queryByTestId("sheet-input")).toBeNull();
    expect(screen.getByLabelText("Name")).toBeTruthy();
  });

  it("marks the submit busy and disabled while pending", async () => {
    await render(
      <FormSheet
        open
        onClose={jest.fn()}
        title="New"
        discard={discard}
        closeLabel="Close"
        submit={{ label: "Save", onPress: jest.fn(), pending: true }}
      >
        <FormInput accessibilityLabel="Name" />
      </FormSheet>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
