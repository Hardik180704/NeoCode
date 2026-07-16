import { useEffect, useMemo, useRef } from "react";
import { z } from "zod";
import { mode as Mode } from "@neocode/database/enums";
import { useNavigate, useLocation } from "react-router";
import { SessionShell } from "../components/session-shell";
import { UserMessage } from "../components/messages";
import { useToast } from "../providers/toast";
import { apiClient } from "../lib/api-client"
import { getErrorMessage } from "../lib/http-errors";

const newSessionStateSchema = z.object({
  message: z.string(),
  mode: z.enum(Mode),
  model: z.string(),
})

export function NewSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const hasStartedRef = useRef(false);

  const state = useMemo(() => {
    const parsed = newSessionStateSchema.safeParse(location.state);
    return parsed.success ? parsed.data : null;
  }, [location.state]);

  // Guard: if naviagted here directly without state, go home
  useEffect(() => {
    if (!state) {
      navigate("/", { replace: true });
    }
  }, [state, navigate]);

  // Create the session on mount - this screen exists to do this
  useEffect(() => {
    if (!state || hasStartedRef.current) return;

    hasStartedRef.current = true;

    let ignore = false;
    const createSession = async () => {
      try {
        const res = await apiClient.sessions.$post({
          json: {
            title: state.message.slice(0, 100),
            cwd: process.cwd(),
            initialMessage: {
              role: "USER",
              content: state.message,
              mode: state.mode,
              model: state.model,
            },
          },
        });

        if (ignore) return;
        if(!res.ok) {
          throw new Error(await getErrorMessage(res));
        }

        const session = await res.json();
        navigate(
          `/sessions/${session.id}`,
          { replace: true, state: { session } }
        );
      } catch (err) {
        if (ignore) return;
        toast.show({
          variant: "error",
          message: err instanceof Error ? err.message : "Failed to create session",
        });
        navigate("/", { replace: true });
      }
    }
    createSession();
    return () => { 
      ignore = true 
    };
  }, [state, toast, navigate]);


  if (!state) return null;

  return (
    <SessionShell onSubmit={() => { }} inputDisabled loading>
      <UserMessage message={state.message} mode={state.mode}/>
    </SessionShell>
  );
}
