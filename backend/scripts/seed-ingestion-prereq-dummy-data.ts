import util from "node:util";
import {
  BillingSource,
  CloudConnectionV2,
  CloudIntegration,
  CloudProvider,
  Tenant,
  User,
  sequelize,
} from "../src/models/index.js";
import { hashPassword } from "../src/utils/password.js";

const DUMMY = {
  tenantName: "Dummy Ingestion Tenant",
  tenantSlug: "dummy-ingestion-tenant",
  userFullName: "Dummy Ingestion User",
  userEmail: "dummy.ingestion@kcx.local",
  userPassword: "Dummy@123456",
  cloudConnectionName: "Dummy AWS Ingestion Connection",
  cloudAccountId: "212345678901",
  sourceName: "Dummy CUR2 Source",
};

async function main(): Promise<void> {
  const now = new Date();

  const [provider] = await CloudProvider.findOrCreate({
    where: { code: "aws" },
    defaults: {
      code: "aws",
      name: "Amazon Web Services",
      status: "active",
    },
  });

  const [tenant] = await Tenant.findOrCreate({
    where: { slug: DUMMY.tenantSlug },
    defaults: {
      name: DUMMY.tenantName,
      slug: DUMMY.tenantSlug,
      status: "active",
    },
  });

  const passwordHash = await hashPassword(DUMMY.userPassword);
  const [user] = await User.findOrCreate({
    where: { email: DUMMY.userEmail },
    defaults: {
      tenantId: tenant.id,
      fullName: DUMMY.userFullName,
      email: DUMMY.userEmail,
      passwordHash,
      role: "owner",
      status: "active",
    },
  });

  await user.update({
    tenantId: tenant.id,
    fullName: DUMMY.userFullName,
    passwordHash,
    role: "owner",
    status: "active",
  });

  const [connection] = await CloudConnectionV2.findOrCreate({
    where: {
      tenantId: tenant.id,
      providerId: provider.id,
      connectionName: DUMMY.cloudConnectionName,
    },
    defaults: {
      tenantId: tenant.id,
      providerId: provider.id,
      connectionName: DUMMY.cloudConnectionName,
      accountType: "payer",
      status: "active",
      region: "us-east-1",
      cloudAccountId: DUMMY.cloudAccountId,
      payerAccountId: DUMMY.cloudAccountId,
      createdBy: user.id,
      connectedAt: now,
      lastValidatedAt: now,
      externalId: `dummy-${Date.now()}`,
      errorMessage: null,
    },
  });

  await connection.update({
    accountType: "payer",
    status: "active",
    region: "us-east-1",
    cloudAccountId: DUMMY.cloudAccountId,
    payerAccountId: DUMMY.cloudAccountId,
    createdBy: user.id,
    connectedAt: now,
    lastValidatedAt: now,
    errorMessage: null,
  });

  const [integration] = await CloudIntegration.findOrCreate({
    where: {
      tenantId: tenant.id,
      detailRecordId: connection.id,
      detailRecordType: "cloud_connection",
    },
    defaults: {
      tenantId: tenant.id,
      createdBy: user.id,
      providerId: provider.id,
      connectionMode: "automatic",
      displayName: DUMMY.cloudConnectionName,
      status: "active",
      detailRecordId: connection.id,
      detailRecordType: "cloud_connection",
      cloudAccountId: DUMMY.cloudAccountId,
      payerAccountId: DUMMY.cloudAccountId,
      lastValidatedAt: now,
      lastSuccessAt: now,
      lastCheckedAt: now,
      statusMessage: "Dummy integration seeded for file ingestion",
      connectedAt: now,
      errorMessage: null,
    },
  });

  await integration.update({
    createdBy: user.id,
    providerId: provider.id,
    connectionMode: "automatic",
    displayName: DUMMY.cloudConnectionName,
    status: "active",
    cloudAccountId: DUMMY.cloudAccountId,
    payerAccountId: DUMMY.cloudAccountId,
    lastValidatedAt: now,
    lastSuccessAt: now,
    lastCheckedAt: now,
    statusMessage: "Dummy integration seeded for file ingestion",
    connectedAt: now,
    errorMessage: null,
  });

  const [billingSource] = await BillingSource.findOrCreate({
    where: {
      tenantId: tenant.id,
      sourceName: DUMMY.sourceName,
    },
    defaults: {
      tenantId: tenant.id,
      cloudConnectionId: connection.id,
      cloudProviderId: provider.id,
      sourceName: DUMMY.sourceName,
      sourceType: "aws_data_exports_cur2",
      setupMode: "cloud_connected",
      format: "parquet",
      schemaType: "cur2",
      status: "active",
      isTemporary: false,
      bucketName: "dummy-cur2-bucket",
      pathPrefix: "cur2/dummy",
      cadence: "daily",
      lastValidatedAt: now,
      lastFileReceivedAt: now,
      lastIngestedAt: now,
    },
  });

  await billingSource.update({
    cloudConnectionId: connection.id,
    cloudProviderId: provider.id,
    sourceType: "aws_data_exports_cur2",
    setupMode: "cloud_connected",
    format: "parquet",
    schemaType: "cur2",
    status: "active",
    isTemporary: false,
    bucketName: "dummy-cur2-bucket",
    pathPrefix: "cur2/dummy",
    cadence: "daily",
    lastValidatedAt: now,
    lastFileReceivedAt: now,
    lastIngestedAt: now,
  });

  console.info("Dummy ingestion prerequisites seeded", {
    user: {
      email: DUMMY.userEmail,
      password: DUMMY.userPassword,
      id: user.id,
    },
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
    },
    cloudConnection: {
      id: connection.id,
      name: connection.connectionName,
      providerId: provider.id,
    },
    cloudIntegration: {
      id: integration.id,
      detailRecordId: integration.detailRecordId,
    },
    billingSource: {
      id: String(billingSource.id),
      sourceName: billingSource.sourceName,
    },
  });
}

main()
  .catch((error) => {
    console.error(
      "Failed to seed dummy ingestion prerequisites:",
      util.inspect(error, { depth: 10, colors: false }),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
