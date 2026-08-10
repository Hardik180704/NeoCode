import { useTheme } from "../../providers/theme";
import { EmptyBorder } from "../border";
import { Mode, type ModeType } from "@neocode/shared";

type Props = {
  message: string;
  mode: ModeType;
};

export function UserMessage({ message, mode }: Props) {
  const { colors } = useTheme();

  return (
    <box width="100%" alignItems="center">
      <box
        border={["left"]}
        borderColor={mode === "PLAN" ? colors.planMode : colors.primary}
        width="100%"
        customBorderChars={{
          ...EmptyBorder,
          vertical: "┃",
          bottomLeft: "╹",
        }}
      >
        <box
          justifyContent="center"
          paddingX={2}
          paddingY={1}
          backgroundColor={colors.surface}
          width="100%"
        >
          <text>{message}</text>
        </box>
      </box>
    </box>
  );
}
