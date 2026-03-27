import { Client, DemoRequest, SlotReservation, sequelize } from "../../models/index.js";
import { generateTemporaryPassword, hashPassword } from "../../utils/password.js";
import {
  getAvailableSlots as fetchAvailableSlotsFromCalcom,
  reserveSlot as reserveCalcomSlot,
} from "../_shared/calcom/calcom.service.js";
import { sendDemoRequestReceivedEmail } from "../_shared/mail/demo-email.service.js";

import type { ScheduleDemoInput } from "./schedule-demo.schema.js";

type SubmitScheduleDemoResult = {
  demoRequestId: number;
  clientId: number;
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

  const { demoRequest, client, slotReservation } = await sequelize.transaction(async (transaction) => {
    const existing = await Client.findOne({
      where: { email: input.companyEmail },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const client =
      existing ??
      (await Client.create(
        {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.companyEmail,
          passwordHash: await hashPassword(generateTemporaryPassword()),
          companyName: input.companyName,
          heardAboutUs: input.heardAboutUs,
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
        heardAboutUs?: string | null;
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
      if (!existing.heardAboutUs && input.heardAboutUs) {
        updates.heardAboutUs = input.heardAboutUs;
      }
      if (Object.keys(updates).length > 0) {
        await existing.update(updates, { transaction });
      }
    }

    const demoRequest = await DemoRequest.create(
      {
        clientId: client.id,
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

    return { demoRequest, client, slotReservation };
  });

  const emailSent = await sendDemoRequestReceivedEmail({
    firstName: client.firstName,
    email: client.email,
    slotStart: input.slotStart,
    slotEnd: input.slotEnd,
    timeZone: input.timeZone,
  });

  return {
    demoRequestId: demoRequest.id,
    clientId: client.id,
    slotReservationId: slotReservation.id,
    status: demoRequest.status,
    emailSent,
  };
}
