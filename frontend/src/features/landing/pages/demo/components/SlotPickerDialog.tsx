import { useEffect, useMemo, useState } from "react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { fetchScheduleDemoSlotsForDate } from "@/features/landing/pages/demo/api/schedule-demo.api"
import { ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"

type SlotValue = { date: string; time: string } | null

type BackendSlot = {
  time: string
  available: boolean
  slotStart: string
  slotEnd: string
}

const FALLBACK_TIME_ZONE = "Asia/Kolkata"

function detectUserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIME_ZONE
  } catch {
    return FALLBACK_TIME_ZONE
  }
}

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  let year = ""
  let month = ""
  let day = ""

  for (const part of parts) {
    if (part.type === "year") year = part.value
    if (part.type === "month") month = part.value
    if (part.type === "day") day = part.value
  }

  return { year, month, day }
}

function toISODate(date: Date, timeZone: string) {
  const { year, month, day } = getDatePartsInTimeZone(date, timeZone)
  return `${year}-${month}-${day}`
}

function fromISODate(iso: string | null) {
  if (!iso) return undefined
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function formatPrettyDate(date: Date, timeZone: string) {
  return date.toLocaleDateString("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function todayInTimeZone(timeZone: string) {
  const { year, month, day } = getDatePartsInTimeZone(new Date(), timeZone)
  return new Date(Number(year), Number(month) - 1, Number(day))
}

export function SlotPickerDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: SlotValue
  onConfirm: (next: {
    date: string
    time: string
    timeZone: string
    slotStart?: string
    slotEnd?: string
  }) => Promise<void>
}) {
  const detectedTimeZone = useMemo(() => detectUserTimeZone(), [])
  const today = useMemo(() => {
    return todayInTimeZone(detectedTimeZone)
  }, [detectedTimeZone])

  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(value?.date ?? null)
  const [selectedTime, setSelectedTime] = useState<string | null>(value?.time ?? null)
  const [slots, setSlots] = useState<BackendSlot[]>([])
  const [slotsTimeZone, setSlotsTimeZone] = useState<string>(detectedTimeZone)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    setSelectedDateIso(value?.date ?? null)
    setSelectedTime(value?.time ?? null)
    setSubmitError(null)
  }, [value, open])

  const selectedDate = useMemo(() => fromISODate(selectedDateIso), [selectedDateIso])

  useEffect(() => {
    if (!open || !selectedDateIso) {
      setSlots([])
      setLoadingSlots(false)
      setSlotsError(null)
      return
    }

    let cancelled = false
    setSlotsError(null)
    setLoadingSlots(true)

    void (async () => {
      try {
        const response = await fetchScheduleDemoSlotsForDate(selectedDateIso, detectedTimeZone)
        if (cancelled) return

        setSlots(response.slots ?? [])
        setSlotsTimeZone(response.timeZone || detectedTimeZone)

        if (selectedTime && !response.slots?.some((slot) => slot.time === selectedTime && slot.available)) {
          setSelectedTime(null)
        }
      } catch (error) {
        if (cancelled) return

        setSlots([])

        if (error instanceof ApiError) {
          setSlotsError(error.message || "Could not load slots.")
        } else {
          setSlotsError("Could not load slots.")
        }
      } finally {
        if (!cancelled) setLoadingSlots(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [detectedTimeZone, open, selectedDateIso, selectedTime])

  const selectedSlot = useMemo(() => {
    if (!selectedTime) return null
    return slots.find((slot) => slot.time === selectedTime && slot.available) ?? null
  }, [slots, selectedTime])

  const selectedSlotAvailable = useMemo(() => {
    return Boolean(selectedSlot)
  }, [selectedSlot])

  async function commitSelection() {
    if (!selectedDateIso || !selectedTime || !selectedSlotAvailable) return

    setSubmitError(null)
    setConfirming(true)

    try {
      await onConfirm({
        date: selectedDateIso,
        time: selectedTime,
        timeZone: slotsTimeZone || detectedTimeZone,
        slotStart: selectedSlot?.slotStart,
        slotEnd: selectedSlot?.slotEnd,
      })
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError) {
        setSubmitError(error.message || "Booking failed. Please try another slot.")
      } else {
        setSubmitError("Booking failed. Please try another slot.")
      }
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (confirming) return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="max-w-[900px] rounded-[28px] border border-[rgba(21,37,49,0.12)] bg-white p-0 shadow-xl">
        <div className="p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg font-semibold text-[#0F1F1A]">
              Select a slot
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[rgba(75,90,83,0.75)]">
              Pick a date and time for your demo.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-[rgba(21,37,49,0.12)] bg-[rgba(21,37,49,0.02)] p-4">
              <DayPicker
                mode="single"
                timeZone={detectedTimeZone}
                selected={selectedDate}
                onSelect={(date) => {
                  if (!date) return
                  setSelectedDateIso(toISODate(date, detectedTimeZone))
                  setSelectedTime(null)
                  setSubmitError(null)
                }}
                disabled={{ before: today }}
                showOutsideDays
                weekStartsOn={1}
                className="w-full"
                classNames={{
                  months: "flex w-full",
                  month: "w-full",
                  caption: "flex items-center justify-between mb-4",
                  caption_label: "text-sm font-semibold text-[#0F1F1A]",
                  nav: "flex items-center gap-2",
                  button_previous:
                    "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(21,37,49,0.12)] bg-white hover:bg-[rgba(21,37,49,0.04)]",
                  button_next:
                    "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(21,37,49,0.12)] bg-white hover:bg-[rgba(21,37,49,0.04)]",
                  table: "w-full border-collapse",
                  head_row: "grid grid-cols-7",
                  head_cell:
                    "px-1 py-1.5 text-center text-[11px] font-semibold text-[rgba(75,90,83,0.75)]",
                  row: "grid grid-cols-7 mt-1",
                  cell: "p-0 text-center",
                  day: cn(
                    "h-10 w-10 rounded-xl text-sm font-medium transition duration-150 mx-auto",
                    "text-[#0F1F1A] hover:bg-[rgba(62,138,118,0.10)]"
                  ),
                  day_selected:
                    "bg-[rgba(62,138,118,0.18)] ring-2 ring-[rgba(62,138,118,0.28)] hover:bg-[rgba(62,138,118,0.18)]",
                  day_today: "font-semibold",
                  day_outside: "text-[rgba(75,90,83,0.28)] opacity-100",
                  day_disabled: "text-[rgba(75,90,83,0.28)]",
                }}
              />
            </div>

            <div className="rounded-2xl border border-[rgba(21,37,49,0.12)] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgba(75,90,83,0.75)]">
                Time slots
              </p>

              <p className="mt-1 text-sm font-semibold text-[#0F1F1A]">
                {selectedDate ? formatPrettyDate(selectedDate, detectedTimeZone) : "Select a date"}
              </p>

              <p className="mt-1 text-[11px] text-[rgba(75,90,83,0.72)]">
                Timezone: {slotsTimeZone || detectedTimeZone}
              </p>

              {!loadingSlots && !slotsError && selectedDateIso && slots.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {slots.map((slot) => {
                    const active = selectedTime === slot.time
                    const disabled = !selectedDate || loadingSlots || !slot.available

                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={disabled || confirming}
                        onClick={() => {
                          if (disabled || confirming) return
                          setSelectedTime(slot.time)
                        }}
                        className={cn(
                          "h-10 rounded-xl border text-sm font-semibold",
                          disabled
                            ? "cursor-not-allowed border-[rgba(21,37,49,0.10)] bg-[rgba(21,37,49,0.03)] text-[rgba(75,90,83,0.35)]"
                            : "border-[rgba(21,37,49,0.14)] bg-white text-[#0F1F1A] hover:bg-[rgba(21,37,49,0.04)]",
                          active
                            ? "border-[rgba(62,138,118,0.42)] bg-[rgba(62,138,118,0.10)]"
                            : "",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.22)]"
                        )}
                      >
                        {slot.time}
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {loadingSlots ? (
                <p className="mt-3 text-xs text-[rgba(75,90,83,0.75)]">Loading slots...</p>
              ) : null}

              {!loadingSlots && slotsError ? (
                <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-2">
                  <p className="text-xs text-red-700">{slotsError}</p>
                </div>
              ) : null}

              {!loadingSlots && !slotsError && selectedDateIso && slots.length === 0 ? (
                <p className="mt-3 text-xs text-[rgba(75,90,83,0.75)]">
                  No slots available for this day.
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  void commitSelection()
                }}
                disabled={
                  !selectedDateIso ||
                  !selectedTime ||
                  !selectedSlotAvailable ||
                  loadingSlots ||
                  Boolean(slotsError) ||
                  confirming
                }
                className={cn(
                  "mt-4 h-11 w-full rounded-xl text-sm font-semibold text-white",
                  "bg-[#3E8A76] hover:bg-[#357563]",
                  "transition duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(62,138,118,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                  !selectedDateIso ||
                    !selectedTime ||
                    !selectedSlotAvailable ||
                    loadingSlots ||
                    Boolean(slotsError) ||
                    confirming
                    ? "cursor-not-allowed opacity-55 hover:bg-[#3E8A76]"
                    : ""
                )}
              >
                {confirming ? "Booking..." : "Confirm slot"}
              </button>

              {submitError ? (
                <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/5 px-3 py-2">
                  <p className="text-xs text-red-700">{submitError}</p>
                </div>
              ) : null}

              <p className="mt-3 text-[11px] leading-5 text-[rgba(75,90,83,0.7)]">
                Select an available time to confirm your demo booking.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
