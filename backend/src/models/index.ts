import { Sequelize } from "sequelize";
import env from "../config/env.js";
import createTempModel from "./temp.js";
import createAuthSessionModel from "./auth-session.js";
import createAdminAuthSessionModel from "./admin-auth-session.js";
import createDemoRequestModel from "./demo-request.js";
import createPasswordResetTokenModel from "./password-reset-token.js";
import createSlotReservationModel from "./slot-reservation.js";
import createAdminUserModel from "./admin-user.js";
import createAnnouncementModel from "./announcement.js";
import createCloudConnectionV2Model from "./cloud-connection-v2.js";
import createCloudProviderModel from "./cloud-provider.js";
import createCloudIntegrationModel from "./cloud-integration.js";
import createClientCloudAccountModel from "./client-cloud-account.js";
import createTenantModel from "./tenant.js";
import createUserModel from "./user.js";
import createRawBillingFileModel from "./raw-billing-file.js";
import createBillingSourceModel from "./billing-source.js";
import createBillingIngestionRunModel from "./billing-ingestion-run.js";
import createBillingIngestionRunFileModel from "./billing-ingestion-run-file.js";
import createAnomalyDetectionRunModel from "./anomaly-detection-run.js";
import createManualCloudConnectionModel from "./manual-cloud-connection.js";
import createS3UploadConnectionModel from "./s3-upload-connection.js";
import createSupportTicketModel from "./support-ticket.js";
import createSupportTicketMessageModel from "./support-ticket-message.js";
import createSupportMeetingModel from "./support-meeting.js";
import createDimBillingAccountModel from "./billing/dim_billing_account.js";
import createDimSubAccountModel from "./billing/dim_sub_account.js";
import createDimRegionModel from "./billing/dim_region.js";
import createDimServiceModel from "./billing/dim_service.js";
import createDimResourceModel from "./billing/dim_resource.js";
import createDimSkuModel from "./billing/dim_sku.js";
import createDimChargeModel from "./billing/dim_charge.js";
import createDimDateModel from "./billing/dim_date.js";
import createDimTagModel from "./billing/dim_tag.js";
import createFactCostLineItemsModel from "./billing/fact_cost_line_items.js";
import createFactCostLineItemTagsModel from "./billing/fact_cost_line_item_tags.js";
import createBillingIngestionRowErrorModel from "./billing/billing_ingestion_row_error.js";
import createResourceInventorySnapshotModel from "./billing/resource_inventory_snapshots.js";
import createResourceUtilizationDailyModel from "./billing/resource_utilization_daily.js";
import createFactAnomaliesModel from "./billing/fact_anomalies.js";
import createAnomalyContributorModel from "./billing/anomaly_contributors.js";
import createCloudtrailSourceModel from "./billing/cloudtrail_sources.js";
import createCloudEventModel from "./billing/cloud_events.js";
import createFactRecommendationsModel from "./billing/fact_recommendations.js";
import createFactCostAllocationsModel from "./billing/fact_cost_allocations.js";
import createFactCommitmentCoverageModel from "./billing/fact_commitment_coverage.js";
import createBudgetsModel from "./billing/budgets.js";
import createBudgetEvaluationsModel from "./billing/budget_evaluations.js";
import createBudgetAlertsModel from "./billing/budget_alerts.js";
import createAggCostHourlyModel from "./billing/agg_cost_hourly.js";
import createAggCostDailyModel from "./billing/agg_cost_daily.js";
import createAggCostMonthlyModel from "./billing/agg_cost_monthly.js";
import createCostPeriodStatusModel from "./billing/cost_period_status.js";
import createEc2CostHistoryDailyModel from "./ec2/ec2_cost_history_daily.js";
import createEc2CostHistoryMonthlyModel from "./ec2/ec2_cost_history_monthly.js";
import createEc2InstanceInventorySnapshotModel from "./ec2/ec2_instance_inventory_snapshots.js";
import createEc2VolumeInventorySnapshotModel from "./ec2/ec2_volume_inventory_snapshots.js";
import createEc2SnapshotInventorySnapshotModel from "./ec2/ec2_snapshot_inventory_snapshots.js";
import createEc2EipInventorySnapshotModel from "./ec2/ec2_eip_inventory_snapshots.js";
import createEc2AmiInventorySnapshotModel from "./ec2/ec2_ami_inventory_snapshots.js";
import createEc2LoadBalancerInventorySnapshotModel from "./ec2/ec2_load_balancer_inventory_snapshots.js";
import createEc2TargetGroupInventorySnapshotModel from "./ec2/ec2_target_group_inventory_snapshots.js";
import createEc2InstanceUtilizationHourlyModel from "./ec2/ec2_instance_utilization_hourly.js";
import createEc2InstanceUtilizationDailyModel from "./ec2/ec2_instance_utilization_daily.js";
import createFactEc2InstanceDailyModel from "./ec2/fact_ec2_instance_daily.js";
import createScheduledJobModel from "./ec2/scheduled_jobs.js";

const dbUrl = new URL(env.dbUrl);
if (!dbUrl.searchParams.has("sslmode")) {
  dbUrl.searchParams.set("sslmode", "require");
}

const sequelize = new Sequelize(dbUrl.toString(), {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});

const Temp = createTempModel(sequelize);
const User = createUserModel(sequelize);
const DemoRequest = createDemoRequestModel(sequelize);
const PasswordResetToken = createPasswordResetTokenModel(sequelize);
const AuthSession = createAuthSessionModel(sequelize);
const AdminUser = createAdminUserModel(sequelize);
const Announcement = createAnnouncementModel(sequelize);
const AdminAuthSession = createAdminAuthSessionModel(sequelize);
const SlotReservation = createSlotReservationModel(sequelize);
const CloudProvider = createCloudProviderModel(sequelize);
const CloudIntegration = createCloudIntegrationModel(sequelize);
const ClientCloudAccount = createClientCloudAccountModel(sequelize);
const CloudConnectionV2 = createCloudConnectionV2Model(sequelize);
const Tenant = createTenantModel(sequelize);
const RawBillingFile = createRawBillingFileModel(sequelize);
const BillingSource = createBillingSourceModel(sequelize);
const BillingIngestionRun = createBillingIngestionRunModel(sequelize);
const BillingIngestionRunFile = createBillingIngestionRunFileModel(sequelize);
const AnomalyDetectionRun = createAnomalyDetectionRunModel(sequelize);
const ManualCloudConnection = createManualCloudConnectionModel(sequelize);
const S3UploadConnection = createS3UploadConnectionModel(sequelize);
const SupportTicket = createSupportTicketModel(sequelize);
const SupportTicketMessage = createSupportTicketMessageModel(sequelize);
const SupportMeeting = createSupportMeetingModel(sequelize);
const DimBillingAccount = createDimBillingAccountModel(sequelize);
const DimSubAccount = createDimSubAccountModel(sequelize);
const DimRegion = createDimRegionModel(sequelize);
const DimService = createDimServiceModel(sequelize);
const DimResource = createDimResourceModel(sequelize);
const DimSku = createDimSkuModel(sequelize);
const DimCharge = createDimChargeModel(sequelize);
const DimDate = createDimDateModel(sequelize);
const DimTag = createDimTagModel(sequelize);
const FactCostLineItems = createFactCostLineItemsModel(sequelize);
const FactCostLineItemTags = createFactCostLineItemTagsModel(sequelize);
const BillingIngestionRowError = createBillingIngestionRowErrorModel(sequelize);
const ResourceInventorySnapshot = createResourceInventorySnapshotModel(sequelize);
const ResourceUtilizationDaily = createResourceUtilizationDailyModel(sequelize);
const FactAnomalies = createFactAnomaliesModel(sequelize);
const AnomalyContributor = createAnomalyContributorModel(sequelize);
const CloudtrailSource = createCloudtrailSourceModel(sequelize);
const CloudEvent = createCloudEventModel(sequelize);
const FactRecommendations = createFactRecommendationsModel(sequelize);
const FactCostAllocations = createFactCostAllocationsModel(sequelize);
const FactCommitmentCoverage = createFactCommitmentCoverageModel(sequelize);
const Budgets = createBudgetsModel(sequelize);
const BudgetEvaluations = createBudgetEvaluationsModel(sequelize);
const BudgetAlerts = createBudgetAlertsModel(sequelize);
const AggCostHourly = createAggCostHourlyModel(sequelize);
const AggCostDaily = createAggCostDailyModel(sequelize);
const AggCostMonthly = createAggCostMonthlyModel(sequelize);
const CostPeriodStatus = createCostPeriodStatusModel(sequelize);
const Ec2CostHistoryDaily = createEc2CostHistoryDailyModel(sequelize);
const Ec2CostHistoryMonthly = createEc2CostHistoryMonthlyModel(sequelize);
const Ec2InstanceInventorySnapshot = createEc2InstanceInventorySnapshotModel(sequelize);
const Ec2VolumeInventorySnapshot = createEc2VolumeInventorySnapshotModel(sequelize);
const Ec2SnapshotInventorySnapshot = createEc2SnapshotInventorySnapshotModel(sequelize);
const Ec2EipInventorySnapshot = createEc2EipInventorySnapshotModel(sequelize);
const Ec2AmiInventorySnapshot = createEc2AmiInventorySnapshotModel(sequelize);
const Ec2LoadBalancerInventorySnapshot = createEc2LoadBalancerInventorySnapshotModel(sequelize);
const Ec2TargetGroupInventorySnapshot = createEc2TargetGroupInventorySnapshotModel(sequelize);
const Ec2InstanceUtilizationHourly = createEc2InstanceUtilizationHourlyModel(sequelize);
const Ec2InstanceUtilizationDaily = createEc2InstanceUtilizationDailyModel(sequelize);
const FactEc2InstanceDaily = createFactEc2InstanceDailyModel(sequelize);
const ScheduledJob = createScheduledJobModel(sequelize);

User.hasMany(DemoRequest, { foreignKey: "userId" });
DemoRequest.belongsTo(User, { foreignKey: "userId" });
DemoRequest.hasMany(SlotReservation, { foreignKey: "demoRequestId" });
SlotReservation.belongsTo(DemoRequest, { foreignKey: "demoRequestId" });

User.hasMany(PasswordResetToken, { foreignKey: "userId" });
PasswordResetToken.belongsTo(User, { foreignKey: "userId" });

User.hasMany(AuthSession, { foreignKey: "userId" });
AuthSession.belongsTo(User, { foreignKey: "userId" });

Tenant.hasMany(CloudConnectionV2, { foreignKey: "tenantId" });
CloudConnectionV2.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(CloudConnectionV2, { foreignKey: "providerId" });
CloudConnectionV2.belongsTo(CloudProvider, { foreignKey: "providerId" });
User.hasMany(CloudConnectionV2, { foreignKey: "createdBy" });
CloudConnectionV2.belongsTo(User, { foreignKey: "createdBy" });
Tenant.hasMany(CloudIntegration, { foreignKey: "tenantId" });
CloudIntegration.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(CloudIntegration, { foreignKey: "providerId" });
CloudIntegration.belongsTo(CloudProvider, { foreignKey: "providerId" });
User.hasMany(CloudIntegration, { foreignKey: "createdBy" });
CloudIntegration.belongsTo(User, { foreignKey: "createdBy" });
Tenant.hasMany(ClientCloudAccount, { foreignKey: "tenantId" });
ClientCloudAccount.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(ClientCloudAccount, { foreignKey: "providerId" });
ClientCloudAccount.belongsTo(CloudProvider, { foreignKey: "providerId" });
CloudConnectionV2.hasMany(ClientCloudAccount, { foreignKey: "cloudConnectionId" });
ClientCloudAccount.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
CloudProvider.hasMany(BillingSource, { foreignKey: "cloudProviderId" });
BillingSource.belongsTo(CloudProvider, { foreignKey: "cloudProviderId" });
BillingSource.hasMany(RawBillingFile, { foreignKey: "billingSourceId" });
RawBillingFile.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
CloudProvider.hasMany(RawBillingFile, { foreignKey: "cloudProviderId" });
RawBillingFile.belongsTo(CloudProvider, { foreignKey: "cloudProviderId" });
User.hasMany(RawBillingFile, { foreignKey: "uploadedBy" });
RawBillingFile.belongsTo(User, { foreignKey: "uploadedBy" });
BillingSource.hasMany(BillingIngestionRun, { foreignKey: "billingSourceId" });
BillingIngestionRun.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
RawBillingFile.hasMany(BillingIngestionRun, { foreignKey: "rawBillingFileId" });
BillingIngestionRun.belongsTo(RawBillingFile, { foreignKey: "rawBillingFileId" });
BillingIngestionRun.hasMany(BillingIngestionRunFile, { foreignKey: "ingestionRunId" });
BillingIngestionRunFile.belongsTo(BillingIngestionRun, { foreignKey: "ingestionRunId" });
BillingIngestionRun.hasMany(AnomalyDetectionRun, { foreignKey: "ingestionRunId" });
AnomalyDetectionRun.belongsTo(BillingIngestionRun, { foreignKey: "ingestionRunId" });
RawBillingFile.hasMany(BillingIngestionRunFile, { foreignKey: "rawBillingFileId" });
BillingIngestionRunFile.belongsTo(RawBillingFile, { foreignKey: "rawBillingFileId" });
Tenant.hasMany(ManualCloudConnection, { foreignKey: "tenantId" });
ManualCloudConnection.belongsTo(Tenant, { foreignKey: "tenantId" });
User.hasMany(ManualCloudConnection, { foreignKey: "createdBy" });
ManualCloudConnection.belongsTo(User, { foreignKey: "createdBy" });
Tenant.hasMany(S3UploadConnection, { foreignKey: "tenantId" });
S3UploadConnection.belongsTo(Tenant, { foreignKey: "tenantId" });
User.hasMany(S3UploadConnection, { foreignKey: "createdBy" });
S3UploadConnection.belongsTo(User, { foreignKey: "createdBy" });
Tenant.hasMany(SupportTicket, { foreignKey: "tenantId" });
SupportTicket.belongsTo(Tenant, { foreignKey: "tenantId" });
User.hasMany(SupportTicket, { foreignKey: "createdBy" });
SupportTicket.belongsTo(User, { foreignKey: "createdBy" });
SupportTicket.hasMany(SupportTicketMessage, { foreignKey: "ticketId" });
SupportTicketMessage.belongsTo(SupportTicket, { foreignKey: "ticketId" });
User.hasMany(SupportTicketMessage, { foreignKey: "senderUserId" });
SupportTicketMessage.belongsTo(User, { foreignKey: "senderUserId" });
Tenant.hasMany(SupportMeeting, { foreignKey: "tenantId" });
SupportMeeting.belongsTo(Tenant, { foreignKey: "tenantId" });
User.hasMany(SupportMeeting, { foreignKey: "requestedBy" });
SupportMeeting.belongsTo(User, { foreignKey: "requestedBy" });
Tenant.hasMany(DimBillingAccount, { foreignKey: "tenantId" });
DimBillingAccount.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(DimBillingAccount, { foreignKey: "providerId" });
DimBillingAccount.belongsTo(CloudProvider, { foreignKey: "providerId" });

Tenant.hasMany(DimSubAccount, { foreignKey: "tenantId" });
DimSubAccount.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(DimSubAccount, { foreignKey: "providerId" });
DimSubAccount.belongsTo(CloudProvider, { foreignKey: "providerId" });

CloudProvider.hasMany(DimRegion, { foreignKey: "providerId" });
DimRegion.belongsTo(CloudProvider, { foreignKey: "providerId" });

CloudProvider.hasMany(DimService, { foreignKey: "providerId" });
DimService.belongsTo(CloudProvider, { foreignKey: "providerId" });

Tenant.hasMany(DimResource, { foreignKey: "tenantId" });
DimResource.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(DimResource, { foreignKey: "providerId" });
DimResource.belongsTo(CloudProvider, { foreignKey: "providerId" });

CloudProvider.hasMany(DimSku, { foreignKey: "providerId" });
DimSku.belongsTo(CloudProvider, { foreignKey: "providerId" });

Tenant.hasMany(DimTag, { foreignKey: "tenantId" });
DimTag.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(DimTag, { foreignKey: "providerId" });
DimTag.belongsTo(CloudProvider, { foreignKey: "providerId" });

DimBillingAccount.hasMany(FactCostLineItems, { foreignKey: "billingAccountKey" });
FactCostLineItems.belongsTo(DimBillingAccount, { foreignKey: "billingAccountKey" });
DimSubAccount.hasMany(FactCostLineItems, { foreignKey: "subAccountKey" });
FactCostLineItems.belongsTo(DimSubAccount, { foreignKey: "subAccountKey" });
DimRegion.hasMany(FactCostLineItems, { foreignKey: "regionKey" });
FactCostLineItems.belongsTo(DimRegion, { foreignKey: "regionKey" });
DimService.hasMany(FactCostLineItems, { foreignKey: "serviceKey" });
FactCostLineItems.belongsTo(DimService, { foreignKey: "serviceKey" });
DimResource.hasMany(FactCostLineItems, { foreignKey: "resourceKey" });
FactCostLineItems.belongsTo(DimResource, { foreignKey: "resourceKey" });
DimSku.hasMany(FactCostLineItems, { foreignKey: "skuKey" });
FactCostLineItems.belongsTo(DimSku, { foreignKey: "skuKey" });
DimCharge.hasMany(FactCostLineItems, { foreignKey: "chargeKey" });
FactCostLineItems.belongsTo(DimCharge, { foreignKey: "chargeKey" });
DimTag.hasMany(FactCostLineItems, { foreignKey: "tagId" });
FactCostLineItems.belongsTo(DimTag, { foreignKey: "tagId" });
FactCostLineItems.hasMany(FactCostLineItemTags, { foreignKey: "factId" });
FactCostLineItemTags.belongsTo(FactCostLineItems, { foreignKey: "factId" });
DimTag.hasMany(FactCostLineItemTags, { foreignKey: "tagId" });
FactCostLineItemTags.belongsTo(DimTag, { foreignKey: "tagId" });
Tenant.hasMany(FactCostLineItemTags, { foreignKey: "tenantId" });
FactCostLineItemTags.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(FactCostLineItemTags, { foreignKey: "providerId" });
FactCostLineItemTags.belongsTo(CloudProvider, { foreignKey: "providerId" });

DimDate.hasMany(FactCostLineItems, { foreignKey: "usageDateKey" });
FactCostLineItems.belongsTo(DimDate, { foreignKey: "usageDateKey", as: "usageDate" });
DimDate.hasMany(FactCostLineItems, { foreignKey: "billingPeriodStartDateKey" });
FactCostLineItems.belongsTo(DimDate, { foreignKey: "billingPeriodStartDateKey", as: "billingPeriodStartDate" });
DimDate.hasMany(FactCostLineItems, { foreignKey: "billingPeriodEndDateKey" });
FactCostLineItems.belongsTo(DimDate, { foreignKey: "billingPeriodEndDateKey", as: "billingPeriodEndDate" });

Tenant.hasMany(FactCostLineItems, { foreignKey: "tenantId" });
FactCostLineItems.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(FactCostLineItems, { foreignKey: "providerId" });
FactCostLineItems.belongsTo(CloudProvider, { foreignKey: "providerId" });
BillingSource.hasMany(FactCostLineItems, { foreignKey: "billingSourceId" });
FactCostLineItems.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
BillingIngestionRun.hasMany(FactCostLineItems, { foreignKey: "ingestionRunId" });
FactCostLineItems.belongsTo(BillingIngestionRun, { foreignKey: "ingestionRunId" });
BillingIngestionRun.hasMany(BillingIngestionRowError, { foreignKey: "ingestionRunId" });
BillingIngestionRowError.belongsTo(BillingIngestionRun, { foreignKey: "ingestionRunId" });
RawBillingFile.hasMany(BillingIngestionRowError, { foreignKey: "rawBillingFileId" });
BillingIngestionRowError.belongsTo(RawBillingFile, { foreignKey: "rawBillingFileId" });
FactCostLineItems.hasMany(FactCostAllocations, { foreignKey: "factId" });
FactCostAllocations.belongsTo(FactCostLineItems, { foreignKey: "factId" });

Tenant.hasMany(ResourceInventorySnapshot, { foreignKey: "tenantId" });
ResourceInventorySnapshot.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(ResourceInventorySnapshot, { foreignKey: "cloudConnectionId" });
ResourceInventorySnapshot.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
CloudProvider.hasMany(ResourceInventorySnapshot, { foreignKey: "providerId" });
ResourceInventorySnapshot.belongsTo(CloudProvider, { foreignKey: "providerId" });
DimResource.hasMany(ResourceInventorySnapshot, { foreignKey: "resourceKey" });
ResourceInventorySnapshot.belongsTo(DimResource, { foreignKey: "resourceKey" });
DimService.hasMany(ResourceInventorySnapshot, { foreignKey: "serviceKey" });
ResourceInventorySnapshot.belongsTo(DimService, { foreignKey: "serviceKey" });
DimRegion.hasMany(ResourceInventorySnapshot, { foreignKey: "regionKey" });
ResourceInventorySnapshot.belongsTo(DimRegion, { foreignKey: "regionKey" });
DimSubAccount.hasMany(ResourceInventorySnapshot, { foreignKey: "subAccountKey" });
ResourceInventorySnapshot.belongsTo(DimSubAccount, { foreignKey: "subAccountKey" });

Tenant.hasMany(ResourceUtilizationDaily, { foreignKey: "tenantId" });
ResourceUtilizationDaily.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(ResourceUtilizationDaily, { foreignKey: "cloudConnectionId" });
ResourceUtilizationDaily.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
CloudProvider.hasMany(ResourceUtilizationDaily, { foreignKey: "providerId" });
ResourceUtilizationDaily.belongsTo(CloudProvider, { foreignKey: "providerId" });
DimResource.hasMany(ResourceUtilizationDaily, { foreignKey: "resourceKey" });
ResourceUtilizationDaily.belongsTo(DimResource, { foreignKey: "resourceKey" });
DimRegion.hasMany(ResourceUtilizationDaily, { foreignKey: "regionKey" });
ResourceUtilizationDaily.belongsTo(DimRegion, { foreignKey: "regionKey" });
DimSubAccount.hasMany(ResourceUtilizationDaily, { foreignKey: "subAccountKey" });
ResourceUtilizationDaily.belongsTo(DimSubAccount, { foreignKey: "subAccountKey" });

Tenant.hasMany(Ec2InstanceInventorySnapshot, { foreignKey: "tenantId" });
Ec2InstanceInventorySnapshot.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(Ec2InstanceInventorySnapshot, { foreignKey: "cloudConnectionId" });
Ec2InstanceInventorySnapshot.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
CloudProvider.hasMany(Ec2InstanceInventorySnapshot, { foreignKey: "providerId" });
Ec2InstanceInventorySnapshot.belongsTo(CloudProvider, { foreignKey: "providerId" });
DimResource.hasMany(Ec2InstanceInventorySnapshot, { foreignKey: "resourceKey" });
Ec2InstanceInventorySnapshot.belongsTo(DimResource, { foreignKey: "resourceKey" });
DimRegion.hasMany(Ec2InstanceInventorySnapshot, { foreignKey: "regionKey" });
Ec2InstanceInventorySnapshot.belongsTo(DimRegion, { foreignKey: "regionKey" });
DimSubAccount.hasMany(Ec2InstanceInventorySnapshot, { foreignKey: "subAccountKey" });
Ec2InstanceInventorySnapshot.belongsTo(DimSubAccount, { foreignKey: "subAccountKey" });

Tenant.hasMany(Ec2InstanceUtilizationHourly, { foreignKey: "tenantId" });
Ec2InstanceUtilizationHourly.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(Ec2InstanceUtilizationHourly, { foreignKey: "cloudConnectionId" });
Ec2InstanceUtilizationHourly.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
CloudProvider.hasMany(Ec2InstanceUtilizationHourly, { foreignKey: "providerId" });
Ec2InstanceUtilizationHourly.belongsTo(CloudProvider, { foreignKey: "providerId" });
DimResource.hasMany(Ec2InstanceUtilizationHourly, { foreignKey: "resourceKey" });
Ec2InstanceUtilizationHourly.belongsTo(DimResource, { foreignKey: "resourceKey" });
DimRegion.hasMany(Ec2InstanceUtilizationHourly, { foreignKey: "regionKey" });
Ec2InstanceUtilizationHourly.belongsTo(DimRegion, { foreignKey: "regionKey" });
DimSubAccount.hasMany(Ec2InstanceUtilizationHourly, { foreignKey: "subAccountKey" });
Ec2InstanceUtilizationHourly.belongsTo(DimSubAccount, { foreignKey: "subAccountKey" });

Tenant.hasMany(Ec2InstanceUtilizationDaily, { foreignKey: "tenantId" });
Ec2InstanceUtilizationDaily.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(Ec2InstanceUtilizationDaily, { foreignKey: "cloudConnectionId" });
Ec2InstanceUtilizationDaily.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
CloudProvider.hasMany(Ec2InstanceUtilizationDaily, { foreignKey: "providerId" });
Ec2InstanceUtilizationDaily.belongsTo(CloudProvider, { foreignKey: "providerId" });
DimResource.hasMany(Ec2InstanceUtilizationDaily, { foreignKey: "resourceKey" });
Ec2InstanceUtilizationDaily.belongsTo(DimResource, { foreignKey: "resourceKey" });
DimRegion.hasMany(Ec2InstanceUtilizationDaily, { foreignKey: "regionKey" });
Ec2InstanceUtilizationDaily.belongsTo(DimRegion, { foreignKey: "regionKey" });
DimSubAccount.hasMany(Ec2InstanceUtilizationDaily, { foreignKey: "subAccountKey" });
Ec2InstanceUtilizationDaily.belongsTo(DimSubAccount, { foreignKey: "subAccountKey" });

Tenant.hasMany(FactEc2InstanceDaily, { foreignKey: "tenantId" });
FactEc2InstanceDaily.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(FactEc2InstanceDaily, { foreignKey: "cloudConnectionId" });
FactEc2InstanceDaily.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
CloudProvider.hasMany(FactEc2InstanceDaily, { foreignKey: "providerId" });
FactEc2InstanceDaily.belongsTo(CloudProvider, { foreignKey: "providerId" });
DimResource.hasMany(FactEc2InstanceDaily, { foreignKey: "resourceKey" });
FactEc2InstanceDaily.belongsTo(DimResource, { foreignKey: "resourceKey" });
DimRegion.hasMany(FactEc2InstanceDaily, { foreignKey: "regionKey" });
FactEc2InstanceDaily.belongsTo(DimRegion, { foreignKey: "regionKey" });
DimSubAccount.hasMany(FactEc2InstanceDaily, { foreignKey: "subAccountKey" });
FactEc2InstanceDaily.belongsTo(DimSubAccount, { foreignKey: "subAccountKey" });

Tenant.hasMany(ScheduledJob, { foreignKey: "tenantId" });
ScheduledJob.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(ScheduledJob, { foreignKey: "cloudConnectionId" });
ScheduledJob.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
BillingSource.hasMany(ScheduledJob, { foreignKey: "billingSourceId" });
ScheduledJob.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
CloudProvider.hasMany(ScheduledJob, { foreignKey: "providerId" });
ScheduledJob.belongsTo(CloudProvider, { foreignKey: "providerId" });

Tenant.hasMany(FactAnomalies, { foreignKey: "tenantId" });
FactAnomalies.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(FactAnomalies, { foreignKey: "cloudConnectionId" });
FactAnomalies.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
DimService.hasMany(FactAnomalies, { foreignKey: "serviceKey" });
FactAnomalies.belongsTo(DimService, { foreignKey: "serviceKey" });
DimRegion.hasMany(FactAnomalies, { foreignKey: "regionKey" });
FactAnomalies.belongsTo(DimRegion, { foreignKey: "regionKey" });
DimResource.hasMany(FactAnomalies, { foreignKey: "resourceKey" });
FactAnomalies.belongsTo(DimResource, { foreignKey: "resourceKey" });
DimSubAccount.hasMany(FactAnomalies, { foreignKey: "subAccountKey" });
FactAnomalies.belongsTo(DimSubAccount, { foreignKey: "subAccountKey" });
BillingSource.hasMany(FactAnomalies, { foreignKey: "billingSourceId" });
FactAnomalies.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
FactAnomalies.hasMany(AnomalyContributor, { foreignKey: "anomalyId" });
AnomalyContributor.belongsTo(FactAnomalies, { foreignKey: "anomalyId" });
Tenant.hasMany(AnomalyDetectionRun, { foreignKey: "tenantId" });
AnomalyDetectionRun.belongsTo(Tenant, { foreignKey: "tenantId" });
BillingSource.hasMany(AnomalyDetectionRun, { foreignKey: "billingSourceId" });
AnomalyDetectionRun.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
CloudConnectionV2.hasMany(AnomalyDetectionRun, { foreignKey: "cloudConnectionId" });
AnomalyDetectionRun.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
User.hasMany(AnomalyDetectionRun, { foreignKey: "createdBy" });
AnomalyDetectionRun.belongsTo(User, { foreignKey: "createdBy" });

Tenant.hasMany(CloudtrailSource, { foreignKey: "tenantId" });
CloudtrailSource.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(CloudtrailSource, { foreignKey: "cloudConnectionId" });
CloudtrailSource.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });

Tenant.hasMany(CloudEvent, { foreignKey: "tenantId" });
CloudEvent.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(CloudEvent, { foreignKey: "cloudConnectionId" });
CloudEvent.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
CloudProvider.hasMany(CloudEvent, { foreignKey: "providerId" });
CloudEvent.belongsTo(CloudProvider, { foreignKey: "providerId" });

Tenant.hasMany(FactRecommendations, { foreignKey: "tenantId" });
FactRecommendations.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(FactRecommendations, { foreignKey: "cloudConnectionId" });
FactRecommendations.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
BillingSource.hasMany(FactRecommendations, { foreignKey: "billingSourceId" });
FactRecommendations.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
DimService.hasMany(FactRecommendations, { foreignKey: "serviceKey" });
FactRecommendations.belongsTo(DimService, { foreignKey: "serviceKey" });
DimSubAccount.hasMany(FactRecommendations, { foreignKey: "subAccountKey" });
FactRecommendations.belongsTo(DimSubAccount, { foreignKey: "subAccountKey" });
DimRegion.hasMany(FactRecommendations, { foreignKey: "regionKey" });
FactRecommendations.belongsTo(DimRegion, { foreignKey: "regionKey" });

Tenant.hasMany(FactCommitmentCoverage, { foreignKey: "tenantId" });
FactCommitmentCoverage.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(FactCommitmentCoverage, { foreignKey: "cloudConnectionId" });
FactCommitmentCoverage.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });

Tenant.hasMany(AggCostHourly, { foreignKey: "tenantId" });
AggCostHourly.belongsTo(Tenant, { foreignKey: "tenantId" });
BillingSource.hasMany(AggCostHourly, { foreignKey: "billingSourceId" });
AggCostHourly.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
BillingIngestionRun.hasMany(AggCostHourly, { foreignKey: "ingestionRunId" });
AggCostHourly.belongsTo(BillingIngestionRun, { foreignKey: "ingestionRunId" });
CloudProvider.hasMany(AggCostHourly, { foreignKey: "providerId" });
AggCostHourly.belongsTo(CloudProvider, { foreignKey: "providerId" });
User.hasMany(AggCostHourly, { foreignKey: "uploadedBy" });
AggCostHourly.belongsTo(User, { foreignKey: "uploadedBy" });

Tenant.hasMany(AggCostDaily, { foreignKey: "tenantId" });
AggCostDaily.belongsTo(Tenant, { foreignKey: "tenantId" });
BillingSource.hasMany(AggCostDaily, { foreignKey: "billingSourceId" });
AggCostDaily.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
BillingIngestionRun.hasMany(AggCostDaily, { foreignKey: "ingestionRunId" });
AggCostDaily.belongsTo(BillingIngestionRun, { foreignKey: "ingestionRunId" });
CloudProvider.hasMany(AggCostDaily, { foreignKey: "providerId" });
AggCostDaily.belongsTo(CloudProvider, { foreignKey: "providerId" });
User.hasMany(AggCostDaily, { foreignKey: "uploadedBy" });
AggCostDaily.belongsTo(User, { foreignKey: "uploadedBy" });

Tenant.hasMany(AggCostMonthly, { foreignKey: "tenantId" });
AggCostMonthly.belongsTo(Tenant, { foreignKey: "tenantId" });
BillingSource.hasMany(AggCostMonthly, { foreignKey: "billingSourceId" });
AggCostMonthly.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
BillingIngestionRun.hasMany(AggCostMonthly, { foreignKey: "ingestionRunId" });
AggCostMonthly.belongsTo(BillingIngestionRun, { foreignKey: "ingestionRunId" });
CloudProvider.hasMany(AggCostMonthly, { foreignKey: "providerId" });
AggCostMonthly.belongsTo(CloudProvider, { foreignKey: "providerId" });
User.hasMany(AggCostMonthly, { foreignKey: "uploadedBy" });
AggCostMonthly.belongsTo(User, { foreignKey: "uploadedBy" });

Tenant.hasMany(CostPeriodStatus, { foreignKey: "tenantId" });
CostPeriodStatus.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(CostPeriodStatus, { foreignKey: "providerId" });
CostPeriodStatus.belongsTo(CloudProvider, { foreignKey: "providerId" });
BillingSource.hasMany(CostPeriodStatus, { foreignKey: "billingSourceId" });
CostPeriodStatus.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
BillingIngestionRun.hasMany(CostPeriodStatus, { foreignKey: "sourceIngestionRunId" });
CostPeriodStatus.belongsTo(BillingIngestionRun, { foreignKey: "sourceIngestionRunId" });

Tenant.hasMany(Ec2CostHistoryDaily, { foreignKey: "tenantId" });
Ec2CostHistoryDaily.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(Ec2CostHistoryDaily, { foreignKey: "providerId" });
Ec2CostHistoryDaily.belongsTo(CloudProvider, { foreignKey: "providerId" });
BillingSource.hasMany(Ec2CostHistoryDaily, { foreignKey: "billingSourceId" });
Ec2CostHistoryDaily.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
CloudConnectionV2.hasMany(Ec2CostHistoryDaily, { foreignKey: "cloudConnectionId" });
Ec2CostHistoryDaily.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
BillingIngestionRun.hasMany(Ec2CostHistoryDaily, { foreignKey: "ingestionRunId" });
Ec2CostHistoryDaily.belongsTo(BillingIngestionRun, { foreignKey: "ingestionRunId" });

Tenant.hasMany(Ec2CostHistoryMonthly, { foreignKey: "tenantId" });
Ec2CostHistoryMonthly.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudProvider.hasMany(Ec2CostHistoryMonthly, { foreignKey: "providerId" });
Ec2CostHistoryMonthly.belongsTo(CloudProvider, { foreignKey: "providerId" });
BillingSource.hasMany(Ec2CostHistoryMonthly, { foreignKey: "billingSourceId" });
Ec2CostHistoryMonthly.belongsTo(BillingSource, { foreignKey: "billingSourceId" });
CloudConnectionV2.hasMany(Ec2CostHistoryMonthly, { foreignKey: "cloudConnectionId" });
Ec2CostHistoryMonthly.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
BillingIngestionRun.hasMany(Ec2CostHistoryMonthly, { foreignKey: "ingestionRunId" });
Ec2CostHistoryMonthly.belongsTo(BillingIngestionRun, { foreignKey: "ingestionRunId" });

Tenant.hasMany(Budgets, { foreignKey: "tenantId" });
Budgets.belongsTo(Tenant, { foreignKey: "tenantId" });
CloudConnectionV2.hasMany(Budgets, { foreignKey: "cloudConnectionId" });
Budgets.belongsTo(CloudConnectionV2, { foreignKey: "cloudConnectionId" });
User.hasMany(Budgets, { foreignKey: "createdBy" });
Budgets.belongsTo(User, { foreignKey: "createdBy" });
Budgets.hasMany(BudgetEvaluations, { foreignKey: "budgetId" });
BudgetEvaluations.belongsTo(Budgets, { foreignKey: "budgetId" });
Budgets.hasMany(BudgetAlerts, { foreignKey: "budgetId" });
BudgetAlerts.belongsTo(Budgets, { foreignKey: "budgetId" });

AdminUser.hasMany(AdminAuthSession, { foreignKey: "adminUserId" });
AdminAuthSession.belongsTo(AdminUser, { foreignKey: "adminUserId" });
AdminUser.hasMany(Announcement, { foreignKey: "createdByAdminId" });
Announcement.belongsTo(AdminUser, { foreignKey: "createdByAdminId" });

Tenant.hasMany(User, { foreignKey: "tenantId" });
User.belongsTo(Tenant, { foreignKey: "tenantId" });

export {
  sequelize,
  Sequelize,
  Temp,
  User,
  DemoRequest,
  SlotReservation,
  PasswordResetToken,
  AuthSession,
  AdminUser,
  Announcement,
  AdminAuthSession,
  CloudProvider,
  CloudIntegration,
  ClientCloudAccount,
  CloudConnectionV2,
  Tenant,
  RawBillingFile,
  BillingSource,
  BillingIngestionRun,
  BillingIngestionRunFile,
  AnomalyDetectionRun,
  ManualCloudConnection,
  S3UploadConnection,
  SupportTicket,
  SupportTicketMessage,
  SupportMeeting,
  DimBillingAccount,
  DimSubAccount,
  DimRegion,
  DimService,
  DimResource,
  DimSku,
  DimCharge,
  DimDate,
  DimTag,
  FactCostLineItems,
  FactCostLineItemTags,
  BillingIngestionRowError,
  ResourceInventorySnapshot,
  ResourceUtilizationDaily,
  FactAnomalies,
  AnomalyContributor,
  CloudtrailSource,
  CloudEvent,
  FactRecommendations,
  FactCostAllocations,
  FactCommitmentCoverage,
  Budgets,
  BudgetEvaluations,
  BudgetAlerts,
  AggCostHourly,
  AggCostDaily,
  AggCostMonthly,
  CostPeriodStatus,
  Ec2CostHistoryDaily,
  Ec2CostHistoryMonthly,
  Ec2InstanceInventorySnapshot,
  Ec2VolumeInventorySnapshot,
  Ec2SnapshotInventorySnapshot,
  Ec2EipInventorySnapshot,
  Ec2AmiInventorySnapshot,
  Ec2LoadBalancerInventorySnapshot,
  Ec2TargetGroupInventorySnapshot,
  Ec2InstanceUtilizationHourly,
  Ec2InstanceUtilizationDaily,
  FactEc2InstanceDaily,
  ScheduledJob,
};
