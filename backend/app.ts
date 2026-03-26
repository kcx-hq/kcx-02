import express, { type Request, type Response } from "express";
import { Temp, sequelize } from "./src/models/index.js";

const app = express();

app.use(express.json());

app.get("/", async (_req: Request, res: Response): Promise<void> => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ message: "Database connection successful" });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown database error";

    res.status(500).json({
      message: "Database connection failed",
      error: message,
    });
  }
});

app.get("/temp-test", async (_req: Request, res: Response): Promise<void> => {
  try {
    const temp = await Temp.create({
      name: `Test ${new Date().toISOString()}`,
    });

    res.status(201).json({
      message: "Temp row inserted",
      data: temp,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown insert error";

    res.status(500).json({
      message: "Failed to insert Temp row",
      error: message,
    });
  }
});

export default app;
