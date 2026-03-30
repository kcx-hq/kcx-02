import { DemoRequest, SlotReservation, User, sequelize } from "../../models/index.js";
import { generateTemporaryPassword, hashPassword } from "../../utils/password.js";
import {
  getAvailableSlots as fetchAvailableSlotsFromCalcom,
  reserveSlot as reserveCalcomSlot,
} from "../_shared/calcom/calcom.service.js";
import { sendDemoRequestReceivedEmail } from "../_shared/mail/demo-email.service.js";

import type { ScheduleDemoInput } from "./schedule-demo.schema.js";

type SubmitScheduleDemoResult = {
  demoRequestId: number;
  userId: number;
  slotReservationId: number;
  status: string;
  emailSent: boolean;
};

type GetAvailableSlotsResult = {
  slotStart: string;
  slotEnd: string;
};

export async function getAvailableSlots(
  start?: Date,
  end?: Date,
  timeZone?: string,
): Promise<GetAvailableSlotsResult[]> {
  return fetchAvailableSlotsFromCalcom(start, end, timeZone);
}

export async function submitScheduleDemo(
  input: ScheduleDemoInput,
): Promise<SubmitScheduleDemoResult> {
  const reservation = await reserveCalcomSlot({
    name: `${input.firstName} ${input.lastName}`.trim(),
    email: input.companyEmail,
    slotStart: input.slotStart,
    slotEnd: input.slotEnd,
    timeZone: input.timeZone,
  });

  const { demoRequest, user, slotReservation } = await sequelize.transaction(async (transaction) => {
    const existing = await User.findOne({
      where: { email: input.companyEmail },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const user =
      existing ??
      (await User.create(
        {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.companyEmail,
          passwordHash: await hashPassword(generateTemporaryPassword()),
          companyName: input.companyName,
          role: "client",
          status: "active",
          source: "schedule_demo",
        },
        { transaction },
      ));

    if (existing) {
      const updates: {
        firstName?: string;
        lastName?: string;
        companyName?: string | null;
      } = {};
      if (!existing.firstName || existing.firstName.trim().length === 0) {
        updates.firstName = input.firstName;
      }
      if (!existing.lastName || existing.lastName.trim().length === 0) {
        updates.lastName = input.lastName;
      }
      if (!existing.companyName && input.companyName) {
        updates.companyName = input.companyName;
      }
      if (Object.keys(updates).length > 0) {
        await existing.update(updates, { transaction });
      }
    }

    const demoRequest = await DemoRequest.create(
      {
        userId: user.id,
        slotStart: input.slotStart,
        slotEnd: input.slotEnd,
        status: "PENDING",
        calcomReservationId: reservation.reservationId,
      },
      { transaction },
    );

    const slotReservation = await SlotReservation.create(
      {
        demoRequestId: demoRequest.id,
        slotStart: input.slotStart,
        slotEnd: input.slotEnd,
        reservationExpiresAt: reservation.reservationExpiresAt,
        calcomReservationId: reservation.reservationId,
        status: "RESERVED",
      },
      { transaction },
    );

    return { demoRequest, user, slotReservation };
  });

  const emailSent = await sendDemoRequestReceivedEmail({
    firstName: user.firstName,
    email: user.email,
    slotStart: input.slotStart,
    slotEnd: input.slotEnd,
    timeZone: input.timeZone,
  });

  return {
    demoRequestId: demoRequest.id,
    userId: user.id,
    slotReservationId: slotReservation.id,
    status: demoRequest.status,
    emailSent,
  };
}
