declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: {
        token: string;
        sessionId: number;
        user: {
          id: number;
          email: string;
          role: string;
        };
      };
    }
  }
}

export {};
