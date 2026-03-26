import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type SlotValue = { date: string; time: string } | null

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

const TIME_SLOTS = [
  "09:00 AM",
  "09:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "01:00 PM",
  "01:30 PM",
  "02:00 PM",
  "02:30 PM",
  "03:00 PM",
  "03:30 PM",
] as const

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function toISODate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function formatPrettyDate(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

function getCalendarDays(month: Date) {
  const first = startOfMonth(month)
  const startDay = (first.getDay() + 6) % 7 // Monday=0
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()

  const cells: Array<{ date: Date; inMonth: boolean }> = []
  for (let i = 0; i < startDay; i++) {
    const d = new Date(first)
    d.setDate(d.getDate() - (startDay - i))
    cells.push({ date: d, inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(month.getFullYear(), month.getMonth(), day), inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date
    const d = new Date(last)
    d.setDate(d.getDate() + 1)
    cells.push({ date: d, inMonth: false })
  }
  return cells
}

export function SlotPickerDialog({
  open,
  onOpenChange,
  value,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: SlotValue
  onSelect: (next: SlotValue) => void
}) {
  const today = useMemo(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }, [])

  const [month, setMonth] = useState(() => startOfMonth(today))
  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(value?.date ?? null)
  const [selectedTime, setSelectedTime] = useState<string | null>(value?.time ?? null)

  const days = useMemo(() => getCalendarDays(month), [month])

  const selectedDate = useMemo(() => {
    if (!selectedDateIso) return null
    const [y, m, d] = selectedDateIso.split("-").map((v) => Number(v))
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d)
  }, [selectedDateIso])

  function commitSelection() {
    if (!selectedDateIso || !selectedTime) return
    onSelect({ date: selectedDateIso, time: selectedTime })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-6">
        <DialogHeader>
          <DialogTitle>Select a slot</DialogTitle>
          <DialogDescription>Pick a date and time for your demo.</DialogDescription>
        </DialogHeader>

        <div className="mt-5 grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
          {/* Calendar */}
          <div className="rounded-2xl border border-[rgba(21,37,49,0.12)] bg-[rgba(21,37,49,0.02)] p-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMonth((m) => addMonths(m, -1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(21,37,49,0.12)] bg-white text-[#0F1F1A] hover:bg-[rgba(21,37,49,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.22)]"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Previous month</span>
              </button>

              <p className="text-sm font-semibold text-[#0F1F1A]">
                {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </p>

              <button
                type="button"
                onClick={() => setMonth((m) => addMonths(m, 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(21,37,49,0.12)] bg-white text-[#0F1F1A] hover:bg-[rgba(21,37,49,0.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.22)]"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Next month</span>
              </button>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-1 text-[11px] font-semibold text-[rgba(75,90,83,0.75)]">
              {WEEKDAYS.map((w) => (
                <div key={w} className="px-1 py-1.5 text-center">
                  {w}
                </div>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {days.map(({ date, inMonth }) => {
                const iso = toISODate(date)
                const isSelected = selectedDateIso === iso
                const isPast = date.getTime() < today.getTime()
                const isDisabled = isPast || !inMonth

                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      setSelectedDateIso(iso)
                      setSelectedTime(null)
                    }}
                    className={cn(
                      "h-10 rounded-xl text-sm font-medium",
                      "transition duration-150",
                      isDisabled
                        ? "cursor-not-allowed text-[rgba(75,90,83,0.28)]"
                        : "text-[#0F1F1A] hover:bg-[rgba(62,138,118,0.10)]",
                      isSelected ? "bg-[rgba(62,138,118,0.18)] ring-2 ring-[rgba(62,138,118,0.28)]" : null
                    )}
                  >
                    {date.getDate()}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Slots */}
          <div className="rounded-2xl border border-[rgba(21,37,49,0.12)] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(75,90,83,0.75)]">
              Time slots
            </p>
            <p className="mt-1 text-sm font-semibold text-[#0F1F1A]">
              {selectedDate ? formatPrettyDate(selectedDate) : "Select a date"}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {TIME_SLOTS.map((slot) => {
                const active = selectedTime === slot
                const disabled = !selectedDate
                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedTime(slot)}
                    className={cn(
                      "h-10 rounded-xl border text-sm font-semibold",
                      disabled
                        ? "cursor-not-allowed border-[rgba(21,37,49,0.10)] bg-[rgba(21,37,49,0.03)] text-[rgba(75,90,83,0.35)]"
                        : "border-[rgba(21,37,49,0.14)] bg-white text-[#0F1F1A] hover:bg-[rgba(21,37,49,0.04)]",
                      active ? "border-[rgba(62,138,118,0.42)] bg-[rgba(62,138,118,0.10)]" : null,
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.22)]"
                    )}
                  >
                    {slot}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={commitSelection}
              disabled={!selectedDateIso || !selectedTime}
              className={cn(
                "mt-4 h-11 w-full rounded-xl text-sm font-semibold text-white",
                "bg-[#3E8A76] hover:bg-[#357563]",
                "transition duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                !selectedDateIso || !selectedTime ? "cursor-not-allowed opacity-55 hover:bg-[#3E8A76]" : null
              )}
            >
              Confirm slot
            </button>

            <p className="mt-3 text-[11px] leading-5 text-[rgba(75,90,83,0.7)]">
              Availability is illustrative for now — backend scheduling comes next.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

