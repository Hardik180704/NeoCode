import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { NeoLensActivityEvent } from "@neocode/shared";

type NeoLensContextValue = {
  recordActivity: (sessionId: string, event: NeoLensActivityEvent) => void;
  getActivity: (sessionId: string) => NeoLensActivityEvent[];
};

const NeoLensContext = createContext<NeoLensContextValue | null>(null);

export function NeoLensProvider({ children }: { children: ReactNode }) {
  const [eventsBySession, setEventsBySession] = useState<
    Record<string, NeoLensActivityEvent[]>
  >({});

  const recordActivity = useCallback(
    (sessionId: string, event: NeoLensActivityEvent) => {
      setEventsBySession((current) => {
        const events = current[sessionId] ?? [];
        const existingIndex = events.findIndex((item) => item.id === event.id);
        const nextEvents = existingIndex === -1
          ? [...events, event]
          : events.map((item, index) => index === existingIndex ? event : item);

        return {
          ...current,
          [sessionId]: nextEvents.toSorted(
            (left, right) => left.timestampMs - right.timestampMs,
          ),
        };
      });
    },
    [],
  );

  const getActivity = useCallback(
    (sessionId: string) => eventsBySession[sessionId] ?? [],
    [eventsBySession],
  );

  const value = useMemo(
    () => ({ recordActivity, getActivity }),
    [recordActivity, getActivity],
  );

  return (
    <NeoLensContext.Provider value={value}>
      {children}
    </NeoLensContext.Provider>
  );
}

export function useNeoLens() {
  const value = useContext(NeoLensContext);
  if (!value) {
    throw new Error("useNeoLens must be used within a NeoLensProvider");
  }
  return value;
}
