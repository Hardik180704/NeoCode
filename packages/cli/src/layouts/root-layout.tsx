import { Outlet } from "react-router";
import { ToastProvider } from "../providers/toast";
import { DialogProvider } from "../providers/dialog";
import { KeyboardLayerProvider } from "../providers/keyboard-layer";
import { ThemeProvider } from "../providers/theme";
import { ThemedRoot } from "./themed-root";
import { PromptConfigProvider } from "../providers/prompt-config";
import { NeoLensProvider } from "../providers/neolens";

export function RootLayout() {
    return (
        <ThemeProvider>
            <ToastProvider>
                <KeyboardLayerProvider>
                    <NeoLensProvider>
                        <DialogProvider>
                            <PromptConfigProvider>
                                <ThemedRoot>
                                    <Outlet />
                                </ThemedRoot>
                            </PromptConfigProvider>
                        </DialogProvider>
                    </NeoLensProvider>
                </KeyboardLayerProvider>
            </ToastProvider>
        </ThemeProvider>
    );
}
