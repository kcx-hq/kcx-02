import type { Request, Response } from "express";
import { HTTP_STATUS } from "../../constants/http-status.js";
import { sendSuccess } from "../../utils/api-response.js";
import { endOfBusinessDayInUTC, startOfBusinessDayInUTC } from "../../utils/business-day.js";
import { BUSINESS_TIMEZONE, resolveTimeZone } from "../../utils/timezone.js";
import { getAvailableSlots, submitScheduleDemo } from "./schedule-demo.service.js";
import {
  parseScheduleDemoBody,
  parseScheduleDemoSlotsDateParam,
  parseScheduleDemoSlotsQuery,
  parseScheduleDemoSlotsTimeZoneQuery,
} from "./schedule-demo.validator.js";

type DailySlotsResponse = {
  date: string;
  timeZone: string;
  slots: Array<{ time: string; available: boolean; slotStart: string; slotEnd: string }>;
};

function toTimeLabelInTimeZone(slotStartIso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(slotStartIso));
}

function toDailySlotsResponse(
  date: string,
  timeZone: string,
  slots: Array<{ slotStart: string; slotEnd: string }>,
): DailySlotsResponse {
  const deduped = new Map<string, { slotStart: string; slotEnd: string }>();
  for (const slot of slots) {
    const label = toTimeLabelInTimeZone(slot.slotStart, timeZone);
    if (!deduped.has(label)) {
      deduped.set(label, { slotStart: slot.slotStart, slotEnd: slot.slotEnd });
    }
  }

  return {
    date,
    timeZone,
    slots: Array.from(deduped.entries()).map(([time, slotRange]) => ({
      time,
      available: true,
      slotStart: slotRange.slotStart,
      slotEnd: slotRange.slotEnd,
    })),
  };
}

export async function handleScheduleDemo(req: Request, res: Response): Promise<void> {
  const input = parseScheduleDemoBody(req.body);
  const result = await submitScheduleDemo(input);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.CREATED,
    message: "Demo request submitted",
    data: result,
  });
}

export async function handleGetScheduleDemoSlots(req: Request, res: Response): Promise<void> {
  const { date, timeZone: requestedTimeZone } = parseScheduleDemoSlotsQuery(req.query);
  const timeZone = resolveTimeZone(requestedTimeZone, BUSINESS_TIMEZONE);

  // Treat YYYY-MM-DD as a local calendar day in the requested timezone.
  const utcStart = startOfBusinessDayInUTC(date, timeZone);
  const utcEnd = endOfBusinessDayInUTC(date, timeZone);
  const slots = await getAvailableSlots(utcStart, utcEnd, timeZone);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Demo slots fetched",
    data: toDailySlotsResponse(date, timeZone, slots),
  });
}

export async function handleGetScheduleDemoSlotsByDate(req: Request, res: Response): Promise<void> {
  const { date } = parseScheduleDemoSlotsDateParam(req.params);
  const { timeZone: requestedTimeZone } = parseScheduleDemoSlotsTimeZoneQuery(req.query);
  const timeZone = resolveTimeZone(requestedTimeZone, BUSINESS_TIMEZONE);
  const utcStart = startOfBusinessDayInUTC(date, timeZone);
  const utcEnd = endOfBusinessDayInUTC(date, timeZone);
  const slots = await getAvailableSlots(utcStart, utcEnd, timeZone);

  sendSuccess({
    res,
    req,
    statusCode: HTTP_STATUS.OK,
    message: "Demo slots fetched",
    data: toDailySlotsResponse(date, timeZone, slots),
  });
}
