const hasTable = async (queryInterface: any, tableName: string) => {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
};

const migration = {
  async up(queryInterface: any, Sequelize: any) {
    if (await hasTable(queryInterface, "dim_date")) {
      return;
    }

    await queryInterface.createTable("dim_date", {
      id: { type: Sequelize.BIGINT, allowNull: false, autoIncrement: true, primaryKey: true },
      full_date: { type: Sequelize.DATEONLY, allowNull: false, unique: true },
      day_of_month: { type: Sequelize.INTEGER, allowNull: false },
      month_of_year: { type: Sequelize.INTEGER, allowNull: false },
      year_number: { type: Sequelize.INTEGER, allowNull: false },
      quarter_number: { type: Sequelize.INTEGER, allowNull: false },
      month_name: { type: Sequelize.STRING(20), allowNull: false },
      day_name: { type: Sequelize.STRING(20), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("NOW()") },
    });
  },

  async down(queryInterface: any) {
    if (!(await hasTable(queryInterface, "dim_date"))) {
      return;
    }
    await queryInterface.dropTable("dim_date");
  },
};

export default migration;

