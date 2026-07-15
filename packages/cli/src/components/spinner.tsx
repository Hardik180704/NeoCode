import "opentui-spinner/react";
import { mode as Mode } from "@neocode/database/enums";
import { useTheme } from "../providers/theme";

type Props = {
  mode?: Mode;
}

export function Spinner({ mode = Mode.BUILD }: Props) {
  const { colors } = useTheme();
  const activeColor = mode === Mode.PLAN ? colors.planMode : colors.primary;

  return <spinner name="aesthetic" color={activeColor} />;
}
