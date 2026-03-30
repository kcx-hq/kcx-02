import { DemoRequest, SlotReservation, Tenant, User, sequelize } from "../../models/index.js";
import { generateTemporaryPassword, hashPassword } from "../../utils/password.js";
import {
  getAvailableSlots as fetchAvailableSlotsFromCalcom,
  reserveSlot as reserveCalcomSlot,
} from "../_shared/calcom/calcom.service.js";
import { sendDemoRequestReceivedEmail } from "../_shared/mail/demo-email.service.js";

import type { ScheduleDemoInput } from "./schedule-demo.schema.js";

type SubmitScheduleDemoResult = {
  demoRequestId: number;
  userId: string;
  tenantId: string;
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

  const { demoRequest, user, tenant, slotReservation } = await sequelize.transaction(
    async (transaction) => {
      const domain = input.companyEmail
        .split("@")[1]
        ?.trim()
        .toLowerCase()
        .replace(/\..*$/, "") ?? "";
      const slug = domain.length > 0 ? domain : input.companyEmail.trim().toLowerCase();

      const existingTenant = await Tenant.findOne({
        where: { slug },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const tenant =
        existingTenant ??
        (await Tenant.create(
          {
            name: (input.companyName ?? "").trim() || slug,
            slug,
            status: "active",
          },
          { transaction },
        ));

      const existingUser = await User.findOne({
        where: { email: input.companyEmail },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      const fullName = `${input.firstName} ${input.lastName}`.trim();

      const user =
        existingUser ??
        (await User.create(
          {
            tenantId: tenant.id,
            fullName,
            email: input.companyEmail,
            passwordHash: await hashPassword(generateTemporaryPassword()),
            role: "admin",
            status: "active",
          },
          { transaction },
        ));

      if (existingUser) {
        const updates: { tenantId?: string; fullName?: string } = {};
        if (existingUser.tenantId !== tenant.id) {
          updates.tenantId = tenant.id;
        }
        if (!existingUser.fullName || existingUser.fullName.trim().length === 0) {
          updates.fullName = fullName;
        }
        if (Object.keys(updates).length > 0) {
          await existingUser.update(updates, { transaction });
        }
      }

      const demoRequest = await DemoRequest.create(
        {
          userId: user.id,
          heardAboutUs: input.heardAboutUs ?? null,
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

      return { demoRequest, user, tenant, slotReservation };
    },
  );

  const emailSent = await sendDemoRequestReceivedEmail({
    firstName: input.firstName,
    email: user.email,
    slotStart: input.slotStart,
    slotEnd: input.slotEnd,
    timeZone: input.timeZone,
  });

  return {
    demoRequestId: demoRequest.id,
    userId: user.id,
    tenantId: tenant.id,
    slotReservationId: slotReservation.id,
    status: demoRequest.status,
    emailSent,
  };
}
