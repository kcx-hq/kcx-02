const migration = {
  async up(queryInterface: any, Sequelize: any) {
    await queryInterface.addColumn("DemoRequests", "meetingUrl", {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface: any) {
    await queryInterface.removeColumn("DemoRequests", "meetingUrl");
  },
};

export default migration;

