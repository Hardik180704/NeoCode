import { Children, type ReactNode } from "react";
import { useTheme } from "../providers/theme";

type Props = {
    children: ReactNode;
}

export function ThemedRoot({ children }: Props) {
    const { colors } = useTheme();

    const cleanChildren = Children.toArray(children).filter(
        (child) => typeof child !== "string"
    );

    return (
        <box
            backgroundColor={colors.background}
            width="100%"
            height="100%"
            flexGrow={1}
        >{cleanChildren}</box>
    )
}