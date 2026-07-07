import { TextAttributes } from "@opentui/core";
import { useTheme } from "../providers/theme";

export function StatusBar() {
  const { colors } = useTheme();

  return (
    <box flexDirection="row" gap={1}>
      <text fg={colors.primary}>Build</text>
      <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
        &#8250;
      </text>
      <text>opus-4-6</text>
    </box>
  );
}
