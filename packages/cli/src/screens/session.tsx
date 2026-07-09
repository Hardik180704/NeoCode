import { useParams } from "react-router";
import { SessionShell } from "../components/session-shell";
import { UserMessage } from "../components/messages";

export function Session() {
  const {id} = useParams();

  return (
    <SessionShell onSubmit={() => {}} inputDisabled loading />
  );
}