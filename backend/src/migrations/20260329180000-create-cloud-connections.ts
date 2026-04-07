/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
const migration = {
    async up() {
        // Legacy cloud_connections bootstrap migration is intentionally disabled.
        // Final schema is owned by 20260330120000-create-cloud-providers-and-cloud-connections-v2.ts.
    },
    async down() {
        // no-op
    },
};
export default migration;



