const seedCodes = ["aws", "azure", "gcp", "oracle", "custom"];

const migration = {
  async up(queryInterface: any) {
    await queryInterface.sequelize.query(`
INSERT INTO cloud_providers (code, name, status)
VALUES
  ('aws', 'Amazon Web Services', 'active'),
  
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  updated_at = NOW();
`);
  },

  async down(queryInterface: any) {
    await queryInterface.bulkDelete("cloud_providers", { code: seedCodes });
  },
};

export default migration;
