export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: {
    url: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  frontend: {
    url?: string;
    urls: string[];
  };
  rateLimit: {
    perMinute: number;
  };
}
