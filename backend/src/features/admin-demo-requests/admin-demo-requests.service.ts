import { ConflictError, NotFoundError } from "../../errors/http-errors.js";
import { DemoRequest, SlotReservation, Tenant, User, sequelize } from "../../models/index.js";
import { createBooking } from "../_shared/calcom/calcom.service.js";
import { sendDemoConfirmedEmail, sendDemoRejectedEmail } from "../_shared/mail/demo-email.service.js";

type DemoRequestInstance = InstanceType<typeof DemoRequest>;
type SlotReservationInstance = InstanceType<typeof SlotReservation>;
type UserInstance = InstanceType<typeof User>;
type TenantInstance = InstanceType<typeof Tenant>;

type DemoRequestSummary = {
  id: number;
  status: string;
  slotStart: string | null;
  slotEnd: string | null;
  calcomBookingId: string | null;
  calcomReservationId: string | null;
  meetingUrl: string | null;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    companyName: string | null;
    heardAboutUs: string | null;
  };
  reservation: {
    id: number;
    status: string;
    slotStart: string;
    slotEnd: string;
    reservationExpiresAt: string;
    calcomReservationId: string;
    updatedAt: string;
  } | null;
};

type DemoRequestActionResult = {
  demoRequest: DemoRequestSummary;
  emailSent: boolean;
};

const toIso = (value: Date | null): string | null => (value ? value.toISOString() : null);

const splitFullName = (fullName: string): { firstName: string; lastName: string } => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
};

const getTenant = (user: UserInstance): TenantInstance | null => {
  return (user as unknown as { Tenant?: TenantInstance }).Tenant ?? null;
};

const getUserOrThrow = async (userId: string): Promise<UserInstance> => {
  const user = await User.findByPk(userId, { include: [{ model: Tenant }] });
  if (!user) throw new NotFoundError("Demo request user not found");
  return user;
};

const getLatestReservation = async (
  demoRequestId: number,
): Promise<SlotReservationInstance | null> =>
  SlotReservation.findOne({
    where: { demoRequestId },
    order: [["updatedAt", "DESC"]],
  });

const toDemoRequestSummary = async (
  demoRequest: DemoRequestInstance,
): Promise<DemoRequestSummary> => {
  const user = await getUserOrThrow(demoRequest.userId);
  const tenant = getTenant(user);
  const { firstName, lastName } = splitFullName(user.fullName);
  const reservation = await getLatestReservation(demoRequest.id);

  return {
    id: demoRequest.id,
    status: demoRequest.status,
    slotStart: toIso(demoRequest.slotStart),
    slotEnd: toIso(demoRequest.slotEnd),
    calcomBookingId: demoRequest.calcomBookingId,
    calcomReservationId: demoRequest.calcomReservationId,
    meetingUrl: demoRequest.meetingUrl,
    createdAt: demoRequest.createdAt.toISOString(),
    updatedAt: demoRequest.updatedAt.toISOString(),
    client: {
      id: user.id,
      firstName,
      lastName,
      email: user.email,
      companyName: tenant?.name ?? null,
      heardAboutUs: demoRequest.heardAboutUs,
    },
    reservation: reservation
      ? {
          id: reservation.id,
          status: reservation.status,
          slotStart: reservation.slotStart.toISOString(),
          slotEnd: reservation.slotEnd.toISOString(),
          reservationExpiresAt: reservation.reservationExpiresAt.toISOString(),
          calcomReservationId: reservation.calcomReservationId,
          updatedAt: reservation.updatedAt.toISOString(),
        }
      : null,
  };
};

const getDemoRequestOrThrow = async (id: number): Promise<DemoRequestInstance> => {
  const demoRequest = await DemoRequest.findByPk(id);
  if (!demoRequest) throw new NotFoundError("Demo request not found");
  return demoRequest;
};

const getPendingRequestForAction = async (
  id: number,
): Promise<{
  demoRequest: DemoRequestInstance;
  reservation: SlotReservationInstance;
  user: UserInstance;
}> => {
  const demoRequest = await getDemoRequestOrThrow(id);

  if (demoRequest.status !== "PENDING") {
    throw new ConflictError("Only pending demo requests can be updated");
  }
  if (!demoRequest.slotStart || !demoRequest.slotEnd) {
    throw new ConflictError("Demo request does not have a valid slot");
  }

  const user = await getUserOrThrow(demoRequest.userId);
  const reservation = await SlotReservation.findOne({
    where: {
      demoRequestId: id,
      status: "RESERVED",
    },
    order: [["updatedAt", "DESC"]],
  });

  if (!reservation) throw new ConflictError("Reserved slot not found for this request");

  return { demoRequest, reservation, user };
};

export async function getAdminDemoRequests(): Promise<DemoRequestSummary[]> {
  const requests = await DemoRequest.findAll({
    order: [["createdAt", "DESC"]],
  });

  return Promise.all(requests.map((demoRequest) => toDemoRequestSummary(demoRequest)));
}

export async function getAdminDemoRequestById(id: number): Promise<DemoRequestSummary> {
  const demoRequest = await getDemoRequestOrThrow(id);
  return toDemoRequestSummary(demoRequest);
}

export async function confirmAdminDemoRequest(id: number): Promise<DemoRequestActionResult> {
  const { demoRequest, reservation, user } = await getPendingRequestForAction(id);
  const slotStart = demoRequest.slotStart as Date;
  const slotEnd = demoRequest.slotEnd as Date;
  const now = new Date();

  if (reservation.reservationExpiresAt.getTime() <= now.getTime()) {
    await SlotReservation.update(
      { status: "RELEASED" },
      {
        where: {
          id: reservation.id,
          demoRequestId: demoRequest.id,
          status: "RESERVED",
        },
      },
    );
    throw new ConflictError("Reserved slot has expired. Please ask the client to book a new slot.");
  }

  const booking = await createBooking({
    name: user.fullName.trim(),
    email: user.email,
    slotStart,
    slotEnd,
    reservationId: reservation.calcomReservationId,
  });

  await sequelize.transaction(async (transaction) => {
    const [updatedRequestCount] = await DemoRequest.update(
      {
        status: "CONFIRMED",
        calcomBookingId: booking.bookingId,
        calcomReservationId: reservation.calcomReservationId,
        meetingUrl: booking.meetingUrl,
      },
      {
        where: { id: demoRequest.id, status: "PENDING" },
        transaction,
      },
    );

    if (updatedRequestCount === 0) {
      throw new ConflictError("Demo request is no longer pending");
    }

    const [updatedReservationCount] = await SlotReservation.update(
      { status: "USED" },
      {
        where: {
          id: reservation.id,
          demoRequestId: demoRequest.id,
          status: "RESERVED",
        },
        transaction,
      },
    );

    if (updatedReservationCount === 0) {
      throw new ConflictError("Reserved slot is no longer available");
    }
  });

  const emailSent = await sendDemoConfirmedEmail({
    firstName: splitFullName(user.fullName).firstName,
    email: user.email,
    slotStart,
    slotEnd,
    meetingType: booking.meetingType,
    meetingUrl: booking.meetingUrl,
  });

  return {
    demoRequest: await getAdminDemoRequestById(id),
    emailSent,
  };
}

export async function rejectAdminDemoRequest(id: number): Promise<DemoRequestActionResult> {
  const { demoRequest, reservation, user } = await getPendingRequestForAction(id);
  const slotStart = demoRequest.slotStart as Date;
  const slotEnd = demoRequest.slotEnd as Date;

  await sequelize.transaction(async (transaction) => {
    const [updatedRequestCount] = await DemoRequest.update(
      {
        status: "REJECTED",
      },
      {
        where: { id: demoRequest.id, status: "PENDING" },
        transaction,
      },
    );

    if (updatedRequestCount === 0) {
      throw new ConflictError("Demo request is no longer pending");
    }

    const [updatedReservationCount] = await SlotReservation.update(
      { status: "RELEASED" },
      {
        where: {
          id: reservation.id,
          demoRequestId: demoRequest.id,
          status: "RESERVED",
        },
        transaction,
      },
    );

    if (updatedReservationCount === 0) {
      throw new ConflictError("Reserved slot is no longer available");
    }
  });

  const emailSent = await sendDemoRejectedEmail({
    firstName: splitFullName(user.fullName).firstName,
    email: user.email,
    slotStart,
    slotEnd,
  });

  return {
    demoRequest: await getAdminDemoRequestById(id),
    emailSent,
  };
}
