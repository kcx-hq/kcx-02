import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import type { Ec2ActionType, Ec2ExtendedActionType, Ec2Instance } from "@/features/actions/types"
import { InstanceActionButtons } from "@/features/actions/components/InstanceActionButtons"
import { InstanceStateBadge } from "@/features/actions/components/InstanceStateBadge"

type InstanceTableProps = {
  instances: Ec2Instance[]
  pendingActionByInstanceId: Record<string, Ec2ExtendedActionType | null>
  targetInstanceTypeById: Record<string, string>
  onActionClick: (instanceId: string, action: Ec2ActionType) => void
  onTargetInstanceTypeChange: (instanceId: string, value: string) => void
  onChangeTypeClick: (instanceId: string) => void
}

function formatLaunchTime(value: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

function formatName(name: string | null, instanceId: string) {
  if (name && name.trim()) return name.trim()
  return instanceId
}

export function InstanceTable({
  instances,
  pendingActionByInstanceId,
  targetInstanceTypeById,
  onActionClick,
  onTargetInstanceTypeChange,
  onChangeTypeClick,
}: InstanceTableProps) {
  return (
    <div className="rounded-md border border-[color:var(--border-light)] bg-white">
      <Table className="min-w-[1200px]">
        <TableHeader className="bg-[color:var(--bg-surface)]">
          <TableRow>
            <TableHead className="px-3 py-2.5">Name</TableHead>
            <TableHead className="px-3 py-2.5">Instance ID</TableHead>
            <TableHead className="px-3 py-2.5">State</TableHead>
            <TableHead className="px-3 py-2.5">Type</TableHead>
            <TableHead className="px-3 py-2.5">Availability Zone</TableHead>
            <TableHead className="px-3 py-2.5">Private IP</TableHead>
            <TableHead className="px-3 py-2.5">Public IP</TableHead>
            <TableHead className="px-3 py-2.5">Launch Time</TableHead>
            <TableHead className="px-3 py-2.5">Rightsizing Test</TableHead>
            <TableHead className="px-3 py-2.5 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {instances.map((instance) => (
            <TableRow key={instance.instanceId} className="hover:bg-[color:var(--bg-surface)]">
              <TableCell className="px-3 py-3 font-medium text-brand-primary">
                {formatName(instance.name, instance.instanceId)}
              </TableCell>
              <TableCell className="px-3 py-3 font-mono text-xs text-text-primary">{instance.instanceId}</TableCell>
              <TableCell className="px-3 py-3">
                <InstanceStateBadge state={instance.state} />
              </TableCell>
              <TableCell className="px-3 py-3 text-text-primary">{instance.instanceType ?? "-"}</TableCell>
              <TableCell className="px-3 py-3 text-text-primary">{instance.availabilityZone ?? "-"}</TableCell>
              <TableCell className="px-3 py-3 text-text-primary">{instance.privateIp ?? "-"}</TableCell>
              <TableCell className="px-3 py-3 text-text-primary">{instance.publicIp ?? "-"}</TableCell>
              <TableCell className="px-3 py-3 text-text-primary">{formatLaunchTime(instance.launchTime)}</TableCell>
              <TableCell className="px-3 py-3">
                <div className="flex min-w-[300px] items-center gap-2">
                  <input
                    value={targetInstanceTypeById[instance.instanceId] ?? ""}
                    onChange={(event) => onTargetInstanceTypeChange(instance.instanceId, event.target.value)}
                    placeholder="e.g. t3.small"
                    className="h-8 w-full rounded-md border border-[color:var(--border-light)] bg-white px-2 text-xs text-text-primary outline-none focus:border-[color:var(--kcx-border-strong)]"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-md whitespace-nowrap"
                    onClick={() => onChangeTypeClick(instance.instanceId)}
                    disabled={Boolean(pendingActionByInstanceId[instance.instanceId])}
                  >
                    {pendingActionByInstanceId[instance.instanceId] === "change-instance-type"
                      ? "Applying..."
                      : "Apply"}
                  </Button>
                </div>
              </TableCell>
              <TableCell className="px-3 py-3">
                <InstanceActionButtons
                  instanceState={instance.state}
                  pendingAction={pendingActionByInstanceId[instance.instanceId] ?? null}
                  onAction={(action) => onActionClick(instance.instanceId, action)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
