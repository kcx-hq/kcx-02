import { Button } from "@/components/ui/button"
import type { Ec2ExtendedActionType, Ec2ActionType, Ec2InstanceState } from "@/features/actions/types"

type InstanceActionButtonsProps = {
  instanceState: Ec2InstanceState | null
  pendingAction: Ec2ExtendedActionType | null
  onAction: (action: Ec2ActionType) => void
}

const STOPPED_LIKE_STATES = new Set(["stopped", "stopping", "shutting-down", "terminated"])
const STARTED_LIKE_STATES = new Set(["running", "pending"])

function normalizeState(state: Ec2InstanceState | null): string {
  return String(state ?? "").trim().toLowerCase()
}

export function InstanceActionButtons({
  instanceState,
  pendingAction,
  onAction,
}: InstanceActionButtonsProps) {
  const normalizedState = normalizeState(instanceState)

  const startDisabled = STARTED_LIKE_STATES.has(normalizedState) || Boolean(pendingAction)
  const stopDisabled = STOPPED_LIKE_STATES.has(normalizedState) || Boolean(pendingAction)
  const rebootDisabled = STOPPED_LIKE_STATES.has(normalizedState) || Boolean(pendingAction)

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-md"
        onClick={() => onAction("start")}
        disabled={startDisabled}
      >
        {pendingAction === "start" ? "Starting..." : "Start"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-md"
        onClick={() => onAction("stop")}
        disabled={stopDisabled}
      >
        {pendingAction === "stop" ? "Stopping..." : "Stop"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-md"
        onClick={() => onAction("reboot")}
        disabled={rebootDisabled}
      >
        {pendingAction === "reboot" ? "Rebooting..." : "Reboot"}
      </Button>
    </div>
  )
}
