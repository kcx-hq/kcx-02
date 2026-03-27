import env from "../../../config/env.js";
import { BadRequestError, ConflictError, InternalServerError } from "../../../errors/http-errors.js";
import { logger } from "../../../utils/logger.js";

type JsonRecord = Record<string, unknown>;

type CalcomSlot = {
  slotStart: Date;
  slotEnd: Date;
};

type ReserveSlotInput = {
  name: string;
  email: string;
  slotStart: Date;
  slotEnd: Date;
};

type ReserveSlotResult = {
  reservationId: string;
  reservationExpiresAt: Date;
};

type CreateBookingInput = {
  name: string;
  email: string;
  slotStart: Date;
  slotEnd: Date;
  reservationId: string;
};

type CreateBookingResult = {
  bookingId: string;
};

const CALCOM_BASE_URL = env.calApiBaseUrl ?? "https://api.cal.com/v2";
const DEFAULT_SLOT_WINDOW_DAYS = 14;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (record: JsonRecord, keys: string[]): string | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
};

const readDate = (record: JsonRecord, keys: string[]): Date | null => {
  const raw = readString(record, keys);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const readNestedRecord = (record: JsonRecord, keys: string[]): JsonRecord | null => {
  for (const key of keys) {
    const value = record[key];
    if (isRecord(value)) return value;
  }
  return null;
};

const getApiBody = (payload: unknown): unknown => {
  if (!isRecord(payload)) return payload;
  if (isRecord(payload.data)) return payload.data;
  return payload;
};

const getRequiredCalApiKey = (): string => {
  if (!env.calApiKey) {
    throw new InternalServerError("Cal.com integration is not configured");
  }
  return env.calApiKey;
};

const buildCalcomUrl = (path: string): URL => {
  const normalizedBase = CALCOM_BASE_URL.endsWith("/") ? CALCOM_BASE_URL : `${CALCOM_BASE_URL}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(normalizedPath, normalizedBase);
};

async function callCalcomApi<TBody = unknown>({
  method,
  path,
  query,
  body,
  conflictMessage,
}: {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: TBody;
  conflictMessage?: string;
}): Promise<unknown> {
  const apiKey = getRequiredCalApiKey();
  const url = buildCalcomUrl(path);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value.trim().length > 0) url.searchParams.set(key, value);
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    logger.error("Cal.com request failed", {
      method,
      path,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new InternalServerError("Unable to reach scheduling provider");
  }

  const rawBody = await response.text().catch(() => "");
  let parsedBody: unknown = null;
  if (rawBody.length > 0) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = null;
    }
  }

  if (!response.ok) {
    logger.error("Cal.com API returned non-2xx response", {
      method,
      path,
      status: response.status,
      response: rawBody.slice(0, 500),
    });

    if (response.status === 409 || response.status === 422) {
      throw new ConflictError(conflictMessage ?? "Scheduling conflict");
    }

    if (response.status >= 400 && response.status < 500) {
      throw new BadRequestError("Invalid scheduling request");
    }

    throw new InternalServerError("Scheduling provider error");
  }

  return parsedBody;
}

const parseSlotsFromArray = (items: unknown[]): CalcomSlot[] =>
  items
    .map((item) => {
      if (!isRecord(item)) return null;
      const slotStart =
        readDate(item, ["slotStart", "start", "startTime"]) ??
        readDate(readNestedRecord(item, ["time", "slot"]) ?? {}, ["start", "startTime"]);
      const slotEnd =
        readDate(item, ["slotEnd", "end", "endTime"]) ??
        readDate(readNestedRecord(item, ["time", "slot"]) ?? {}, ["end", "endTime"]);

      if (!slotStart || !slotEnd) return null;
      return { slotStart, slotEnd };
    })
    .filter((slot): slot is CalcomSlot => slot !== null);

const parseSlots = (payload: unknown): CalcomSlot[] => {
  const apiBody = getApiBody(payload);

  if (Array.isArray(apiBody)) {
    return parseSlotsFromArray(apiBody);
  }

  if (!isRecord(apiBody)) {
    return [];
  }

  if (Array.isArray(apiBody.slots)) {
    return parseSlotsFromArray(apiBody.slots);
  }

  const flattened: unknown[] = [];
  for (const value of Object.values(apiBody)) {
    if (Array.isArray(value)) flattened.push(...value);
  }
  return parseSlotsFromArray(flattened);
};

const parseReservationResult = (payload: unknown): ReserveSlotResult => {
  const apiBody = getApiBody(payload);
  if (!isRecord(apiBody)) {
    throw new InternalServerError("Invalid reserve slot response");
  }

  const reservationId =
    readString(apiBody, ["reservationId", "id", "uid"]) ??
    readString(readNestedRecord(apiBody, ["reservation"]) ?? {}, ["id", "uid"]);

  const reservationExpiresAt =
    readDate(apiBody, ["reservationExpiresAt", "expiresAt"]) ??
    readDate(readNestedRecord(apiBody, ["reservation"]) ?? {}, ["expiresAt"]);

  if (!reservationId) {
    throw new InternalServerError("Scheduling provider did not return reservation id");
  }

  return {
    reservationId,
    reservationExpiresAt:
      reservationExpiresAt ?? new Date(Date.now() + env.calReservationTtlMinutes * 60_000),
  };
};

const parseBookingResult = (payload: unknown): CreateBookingResult => {
  const apiBody = getApiBody(payload);
  if (!isRecord(apiBody)) {
    throw new InternalServerError("Invalid booking response");
  }

  const bookingId =
    readString(apiBody, ["bookingId", "id", "uid"]) ??
    readString(readNestedRecord(apiBody, ["booking"]) ?? {}, ["id", "uid"]);

  if (!bookingId) {
    throw new InternalServerError("Scheduling provider did not return booking id");
  }

  return { bookingId };
};

export async function getAvailableSlots(
  start?: Date,
  end?: Date,
): Promise<Array<{ slotStart: string; slotEnd: string }>> {
  const from = start ?? new Date();
  const to = end ?? new Date(from.getTime() + DEFAULT_SLOT_WINDOW_DAYS * 24 * 60 * 60_000);

  const payload = await callCalcomApi({
    method: "GET",
    path: "/slots",
    query: {
      start: from.toISOString(),
      end: to.toISOString(),
      timeZone: env.calTimezone,
      ...(env.calEventTypeId ? { eventTypeId: env.calEventTypeId } : {}),
    },
  });

  return parseSlots(payload).map((slot) => ({
    slotStart: slot.slotStart.toISOString(),
    slotEnd: slot.slotEnd.toISOString(),
  }));
}

export async function reserveSlot(input: ReserveSlotInput): Promise<ReserveSlotResult> {
  const payload = await callCalcomApi({
    method: "POST",
    path: "/slots/reserve",
    conflictMessage: "Selected slot is unavailable",
    body: {
      name: input.name,
      email: input.email,
      slotStart: input.slotStart.toISOString(),
      slotEnd: input.slotEnd.toISOString(),
      timeZone: env.calTimezone,
      ...(env.calEventTypeId ? { eventTypeId: env.calEventTypeId } : {}),
    },
  });

  return parseReservationResult(payload);
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const payload = await callCalcomApi({
    method: "POST",
    path: "/bookings",
    body: {
      name: input.name,
      email: input.email,
      reservationId: input.reservationId,
      slotStart: input.slotStart.toISOString(),
      slotEnd: input.slotEnd.toISOString(),
      timeZone: env.calTimezone,
      ...(env.calEventTypeId ? { eventTypeId: env.calEventTypeId } : {}),
    },
  });

  return parseBookingResult(payload);
}
