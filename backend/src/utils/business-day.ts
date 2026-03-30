type IsoDateParts = {
  year: number;
  month: number;
  day: number;
};

type TimeParts = {
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

const TIME_LABEL_REGEX = /^(0[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i;

function parseIsoDateParts(dateString: string): IsoDateParts | null {
  const match = ISO_DATE_REGEX.exec(dateString);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function getOffsetMsForTimeZone(atUtc: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(atUtc);
  const values: Record<string, number> = {};

  for (const part of parts) {
    if (part.type === "literal") continue;
    values[part.type] = Number(part.value);
  }

  const asUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
    atUtc.getUTCMilliseconds(),
  );

  return asUtc - atUtc.getTime();
}

function zonedLocalToUtc(date: IsoDateParts, time: TimeParts, timeZone: string): Date {
  let guess = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    time.hour,
    time.minute,
    time.second,
    time.millisecond,
  );

  for (let i = 0; i < 4; i += 1) {
    const offset = getOffsetMsForTimeZone(new Date(guess), timeZone);
    const adjusted =
      Date.UTC(
        date.year,
        date.month - 1,
        date.day,
        time.hour,
        time.minute,
        time.second,
        time.millisecond,
      ) - offset;
    if (adjusted === guess) break;
    guess = adjusted;
  }

  return new Date(guess);
}

export function isValidIsoDateString(dateString: string): boolean {
  return parseIsoDateParts(dateString) !== null;
}

export function startOfBusinessDayInUTC(dateString: string, timeZone: string): Date {
  const date = parseIsoDateParts(dateString);
  if (!date) throw new Error("Invalid date");

  return zonedLocalToUtc(
    date,
    { hour: 0, minute: 0, second: 0, millisecond: 0 },
    timeZone,
  );
}

export function endOfBusinessDayInUTC(dateString: string, timeZone: string): Date {
  const date = parseIsoDateParts(dateString);
  if (!date) throw new Error("Invalid date");

  return zonedLocalToUtc(
    date,
    { hour: 23, minute: 59, second: 59, millisecond: 999 },
    timeZone,
  );
}

export function parseTimeLabel(timeLabel: string): { hour: number; minute: number } | null {
  const match = TIME_LABEL_REGEX.exec(timeLabel.trim());
  if (!match) return null;

  const rawHour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  const hour =
    meridiem === "AM"
      ? rawHour === 12
        ? 0
        : rawHour
      : rawHour === 12
        ? 12
        : rawHour + 12;

  return { hour, minute };
}

export function businessDateTimeLabelToUTC(
  dateString: string,
  timeLabel: string,
  timeZone: string,
): Date {
  const date = parseIsoDateParts(dateString);
  if (!date) throw new Error("Invalid date");

  const time = parseTimeLabel(timeLabel);
  if (!time) throw new Error("Invalid time");

  return zonedLocalToUtc(
    date,
    { hour: time.hour, minute: time.minute, second: 0, millisecond: 0 },
    timeZone,
  );
}
