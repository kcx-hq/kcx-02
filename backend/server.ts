import "dotenv/config";
import app from "./app.js";
import { sequelize } from "./src/models/index.js";

const portRaw = process.env.PORT;
const PORT = Number(portRaw ?? 5000);

const startServer = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log("Database connected");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown startup error";
    console.error("Unable to connect to database:", message);
    process.exit(1);
  }
};

void startServer();
