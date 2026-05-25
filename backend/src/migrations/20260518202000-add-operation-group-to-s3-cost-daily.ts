import type { QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE s3_cost_daily
    ADD COLUMN IF NOT EXISTS operation_group text;
  `);

  await queryInterface.sequelize.query(`
    UPDATE s3_cost_daily
    SET operation_group = CASE
      WHEN operation IS NULL THEN 'Other'

      WHEN lower(operation) LIKE '%putobject%'
        OR lower(operation) LIKE '%copyobject%'
        OR lower(operation) LIKE '%uploadpart%'
        OR lower(operation) LIKE '%multipartupload%'
      THEN 'Write'

      WHEN lower(operation) LIKE '%getobject%'
        OR lower(operation) LIKE '%headobject%'
        OR lower(operation) LIKE '%selectobject%'
      THEN 'Read'

      WHEN lower(operation) LIKE '%listbucket%'
        OR lower(operation) LIKE '%listallmybuckets%'
        OR lower(operation) LIKE '%readacl%'
        OR lower(operation) LIKE '%getbucket%'
        OR lower(operation) LIKE '%headbucket%'
        OR lower(operation) LIKE '%readbucket%'
      THEN 'List & Metadata'

      WHEN lower(operation) LIKE '%deleteobject%'
        OR lower(operation) LIKE '%abortmultipartupload%'
      THEN 'Delete'

      WHEN lower(operation) LIKE '%restore%'
        OR lower(operation) LIKE '%lifecycle%'
        OR lower(operation) LIKE '%glacier%'
      THEN 'Lifecycle & Archive'

      WHEN lower(operation) LIKE '%replication%'
        OR lower(operation) LIKE '%replicate%'
      THEN 'Replication'

      ELSE 'Other'
    END
    WHERE operation_group IS NULL;
  `);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query(`
    ALTER TABLE s3_cost_daily
    DROP COLUMN IF EXISTS operation_group;
  `);
}

