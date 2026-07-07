import { useCallback, useRef, useState, useEffect, type ReactNode } from "react";
import { ScrollBoxRenderable, Text, TextAttributes, type InputRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useKeyboardLayer } from "../providers/keyboard-layer";
import { useTheme } from "../providers/theme";

const MAX_VISIBLE_ITEMS = 6;

type DialogSearchListProps<T> = {
    items: T[];
    onSelect: (item: T) => void;
    onHighlight?: (item: T) => void;
    filterFn: (item: T, query: string) => boolean;
    renderItem: (item: T, isSelected: boolean) => ReactNode;
    getKey: (item: T) => string;
    placeholder?: string;
    emptyText?: string;
};

export function DialogSearchList<T>({
    items,
    onSelect,
    onHighlight,
    filterFn,
    renderItem,
    getKey,
    placeholder = "Search",
    emptyText = "No results",
}: DialogSearchListProps<T>) {
    const [searchValue, setSearchValue] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<InputRenderable>(null);
    const scrollRef = useRef<ScrollBoxRenderable>(null);
    const { isTopLayer } = useKeyboardLayer();
    const { colors } = useTheme();

    const handleContentChange = useCallback(() => {
        const text = inputRef.current?.value ?? "";
        setSearchValue(text);
        setSelectedIndex(0);

        const scrollbox = scrollRef.current;
        if (scrollbox) {
            scrollbox.scrollTo(0);
        }
    }, []);

    const filtered = searchValue ? items.filter((item) => filterFn(item, searchValue)) : items;
    const visibleHeight = Math.min(filtered.length, MAX_VISIBLE_ITEMS);

    useKeyboard((key) => {
        if (!isTopLayer("dialog")) return;

        if (key.name === "return" || key.name === "enter") {
            const item = filtered[selectedIndex];
            if (item) {
                onSelect(item);
            }
        } else if (key.name === "up") {
            setSelectedIndex((i) => {
                const newIndex = Math.max(0, i - 1);
                const sb = scrollRef.current;
                if (sb && newIndex < sb.scrollTop) {
                    sb.scrollTo(newIndex);
                }
                const item = filtered[newIndex];
                if (item && onHighlight) onHighlight(item);
                return newIndex;
            });
        } else if (key.name === "down") {
            setSelectedIndex((i) => {
                if (filtered.length === 0) return 0;
                const newIndex = Math.min(filtered.length - 1, i + 1);
                const sb = scrollRef.current;
                if (sb) {
                    const viewportHeight = sb.viewport.height;
                    const visibleEnd = sb.scrollTop + viewportHeight - 1;
                    if (newIndex > visibleEnd) {
                        sb.scrollTo(newIndex - viewportHeight + 1);
                    }
                }
                const item = filtered[newIndex];
                if (item && onHighlight) onHighlight(item);
                return newIndex;
            })
        }
    });

    return (
        <box flexDirection="column" gap={1}>
            <input
                ref={inputRef}
                onContentChange={handleContentChange}
                focused
                placeholder={placeholder} />
            {filtered.length === 0 ? (
                <text attributes={TextAttributes.DIM}>
                    {emptyText}
                </text>
            ) : (
                <scrollbox ref={scrollRef} height={visibleHeight}>
                    {filtered.map((item, i) => {
                        const isSelected = i === selectedIndex;
                        return (
                            <box
                                key={getKey(item)}
                                flexDirection="row"
                                height={1}
                                overflow="hidden"
                                backgroundColor={isSelected ? colors.selection : undefined}
                                onMouseMove={() => {
                                    setSelectedIndex(i);
                                    if (item && onHighlight) onHighlight(item);
                                }}
                                onMouseDown={() => onSelect(item)}
                            >
                                {renderItem(item, isSelected)}
                            </box>
                        );
                    })}
                </scrollbox>
            )}
        </box>
    );
};
