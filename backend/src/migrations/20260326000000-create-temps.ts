const migration = {
  async up(queryInterface: any, Sequelize: any) {
    await queryInterface.createTable("Temps", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  async down(queryInterface: any) {
    await queryInterface.dropTable("Temps");
  },
};

export default migration;

