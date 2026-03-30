import env from "../../../config/env.js";
import { BadRequestError, ConflictError, InternalServerError } from "../../../errors/http-errors.js";
import { BUSINESS_TIMEZONE, resolveTimeZone } from "../../../utils/timezone.js";
import { logger } from "../../../utils/logger.js";

type JsonRecord = Record<string, unknown>;

type CalcomSlot = {
  slotStart: Date;
  slotEnd: Date | undefined;
};

type ReserveSlotInput = {
  name: string;
  email: string;
  slotStart: Date;
  slotEnd: Date;
  timeZone?: string;
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
  timeZone?: string;
};

type CreateBookingResult = {
  bookingId: string;
  meetingType: string | null;
  meetingUrl: string | null;
};

const CALCOM_BASE_URL = env.calApiBaseUrl ?? "https://api.cal.com/v2";
const CALCOM_API_VERSION = env.calApiVersion;
const CALCOM_SLOTS_API_VERSION = env.calSlotsApiVersion;
const CALCOM_BOOKINGS_API_VERSION = env.calBookingsApiVersion;
const DEFAULT_SLOT_WINDOW_DAYS = 14;
const DEFAULT_SLOT_DURATION_MINUTES = 30;

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
  apiVersion,
}: {
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string>;
  body?: TBody;
  conflictMessage?: string;
  apiVersion?: string;
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
        "cal-api-version": apiVersion ?? CALCOM_API_VERSION,
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
      throw new BadRequestError(
        "Invalid scheduling request",
        parsedBody ??
          (rawBody.length > 0 ? { providerResponse: rawBody.slice(0, 500) } : undefined),
      );
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
        readDate(readNestedRecord(item, ["time", "slot"]) ?? {}, ["end", "endTime"]) ??
        undefined;

      if (!slotStart) return null;
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
    readString(apiBody, ["reservationId", "reservationUid", "id", "uid"]) ??
    readString(readNestedRecord(apiBody, ["reservation"]) ?? {}, ["id", "uid", "reservationUid"]);

  const reservationExpiresAt =
    readDate(apiBody, ["reservationExpiresAt", "reservationUntil", "expiresAt"]) ??
    readDate(readNestedRecord(apiBody, ["reservation"]) ?? {}, ["expiresAt", "reservationUntil"]);

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

  const { meetingType, meetingUrl } = extractMeetingInfo(apiBody);

  return { bookingId, meetingType, meetingUrl };
};

const isValidUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

const normalizeUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || !isValidUrl(trimmed)) return null;
  return trimmed;
};

const normalizeLabel = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const inferMeetingTypeFromUrl = (meetingUrl: string): string | null => {
  const normalized = meetingUrl.toLowerCase();
  if (normalized.includes("meet.google.com")) return "Google Meet";
  if (normalized.includes("zoom.us")) return "Zoom";
  if (normalized.includes("teams.microsoft.com")) return "Microsoft Teams";
  return null;
};

const extractMeetingInfoFromLocation = (
  locationValue: unknown,
): { meetingType: string | null; meetingUrl: string | null } => {
  if (!locationValue) {
    return { meetingType: null, meetingUrl: null };
  }

  if (typeof locationValue === "string") {
    const asUrl = normalizeUrl(locationValue);
    if (asUrl) {
      return {
        meetingType: inferMeetingTypeFromUrl(asUrl),
        meetingUrl: asUrl,
      };
    }
    return { meetingType: normalizeLabel(locationValue), meetingUrl: null };
  }

  if (!isRecord(locationValue)) {
    return { meetingType: null, meetingUrl: null };
  }

  const nestedLocation = readNestedRecord(locationValue, ["location", "data", "value"]);
  if (nestedLocation) {
    const nested = extractMeetingInfoFromLocation(nestedLocation);
    if (nested.meetingUrl || nested.meetingType) return nested;
  }

  const meetingUrl =
    normalizeUrl(readString(locationValue, ["url", "meetingUrl", "meetingLink", "link", "href"])) ??
    null;
  const meetingType =
    normalizeLabel(readString(locationValue, ["type", "label", "displayName", "name"])) ??
    (meetingUrl ? inferMeetingTypeFromUrl(meetingUrl) : null);

  return { meetingType, meetingUrl };
};

const extractMeetingInfo = (apiBody: JsonRecord): { meetingType: string | null; meetingUrl: string | null } => {
  const bookingRecord = readNestedRecord(apiBody, ["booking"]) ?? apiBody;

  const locationCandidate =
    bookingRecord.location ?? apiBody.location ?? readNestedRecord(bookingRecord, ["location"]);
  const fromLocation = extractMeetingInfoFromLocation(locationCandidate);
  if (fromLocation.meetingUrl) {
    return fromLocation;
  }

  const fallbackMeetingUrl =
    normalizeUrl(
      readString(bookingRecord, [
        "meetingUrl",
        "meetingLink",
        "videoCallUrl",
        "hangoutLink",
        "joinUrl",
      ]),
    ) ??
    normalizeUrl(
      readString(apiBody, ["meetingUrl", "meetingLink", "videoCallUrl", "hangoutLink", "joinUrl"]),
    );

  const fallbackMeetingType =
    fromLocation.meetingType ??
    normalizeLabel(readString(bookingRecord, ["locationType", "locationLabel", "meetingType"])) ??
    normalizeLabel(readString(apiBody, ["locationType", "locationLabel", "meetingType"])) ??
    (fallbackMeetingUrl ? inferMeetingTypeFromUrl(fallbackMeetingUrl) : null);

  return {
    meetingType: fallbackMeetingType,
    meetingUrl: fallbackMeetingUrl,
  };
};

export async function getAvailableSlots(
  start?: Date,
  end?: Date,
  timeZone?: string,
): Promise<Array<{ slotStart: string; slotEnd: string }>> {
  const from = start ?? new Date();
  const to = end ?? new Date(from.getTime() + DEFAULT_SLOT_WINDOW_DAYS * 24 * 60 * 60_000);
  const effectiveTimeZone = resolveTimeZone(timeZone, BUSINESS_TIMEZONE);

  const payload = await callCalcomApi({
    method: "GET",
    path: "/slots",
    apiVersion: CALCOM_SLOTS_API_VERSION,
    query: {
      start: from.toISOString(),
      end: to.toISOString(),
      timeZone: effectiveTimeZone,
      ...(env.calEventTypeId ? { eventTypeId: String(env.calEventTypeId) } : {}),
    },
  });

  return parseSlots(payload).map((slot) => ({
    slotStart: slot.slotStart.toISOString(),
    slotEnd: (
      slot.slotEnd ?? new Date(slot.slotStart.getTime() + DEFAULT_SLOT_DURATION_MINUTES * 60_000)
    ).toISOString(),
  }));
}

export async function reserveSlot(input: ReserveSlotInput): Promise<ReserveSlotResult> {
  const effectiveTimeZone = resolveTimeZone(input.timeZone, BUSINESS_TIMEZONE);
  const payload = await callCalcomApi({
    method: "POST",
    path: "/slots/reservations",
    apiVersion: CALCOM_SLOTS_API_VERSION,
    conflictMessage: "Selected slot is unavailable",
    body: {
      name: input.name,
      email: input.email,
      slotStart: input.slotStart.toISOString(),
      slotEnd: input.slotEnd.toISOString(),
      timeZone: effectiveTimeZone,
      ...(env.calEventTypeId ? { eventTypeId: env.calEventTypeId } : {}),
    },
  });

  return parseReservationResult(payload);
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const effectiveTimeZone = resolveTimeZone(input.timeZone, BUSINESS_TIMEZONE);
  const payload = await callCalcomApi({
    method: "POST",
    path: "/bookings",
    apiVersion: CALCOM_BOOKINGS_API_VERSION,
    body: {
      start: input.slotStart.toISOString(),
      attendee: {
        name: input.name,
        email: input.email,
        timeZone: effectiveTimeZone,
        language: "en",
      },
      metadata: {
        reservationId: input.reservationId,
        requestedSlotEnd: input.slotEnd.toISOString(),
      },
      ...(env.calEventTypeId ? { eventTypeId: env.calEventTypeId } : {}),
    },
  });

  return parseBookingResult(payload);
}
