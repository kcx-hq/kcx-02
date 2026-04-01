declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: {
        token: string;
        sessionId: number;
        user: {
          id: string | number;
          email: string;
          role: string;
          tenantId?: string;
        };
      };
    }
  }
}

export {};
