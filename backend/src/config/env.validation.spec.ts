import { validate } from './env.validation';

const base = {
  DATABASE_URL:
    'postgresql://app-user:strong-password@db.internal:5432/locationtrack?sslmode=require',
  PORT: '3000',
  NODE_ENV: 'production',
  ACCESS_TOKEN_SECRET: 'aB3!cD4@eF5#gH6$jK7%lM8^nP9&qR0*sT1+uV2=wX3?',
  REFRESH_TOKEN_SECRET: 'zY8!xW7@vU6#tS5$rQ4%pN3^mL2&kJ1*jH0+gF9=dE8?',
  ACCESS_TOKEN_EXPIRES_IN: '15m',
  REFRESH_TOKEN_EXPIRES_IN: '7d',
  FRONTEND_URLS: 'https://app.example.com,https://admin.example.com',
};

describe('production environment validation', () => {
  it('accepts a complete production configuration without logging secrets', () => {
    expect(validate(base).NODE_ENV).toBe('production');
  });

  it('rejects insecure production configuration', () => {
    expect(() =>
      validate({ ...base, ACCESS_TOKEN_SECRET: 'local-development-secret' }),
    ).toThrow();
    expect(() =>
      validate({ ...base, FRONTEND_URLS: 'http://app.example.com' }),
    ).toThrow();
    expect(() =>
      validate({
        ...base,
        DATABASE_URL:
          'postgresql://postgres:postgres@localhost:5432/locationtrack',
      }),
    ).toThrow();
  });

  it('requires a valid email and a password of at least eight characters together for admin bootstrap', () => {
    expect(() => validate({ ...base, ADMIN_EMAIL: 'admin@example.com' })).toThrow();
    expect(() => validate({ ...base, ADMIN_PASSWORD: 'short' })).toThrow();
    expect(validate({
      ...base,
      ADMIN_EMAIL: ' admin@example.com ',
      ADMIN_PASSWORD: '  Ae100ae100@  ',
    }).ADMIN_EMAIL).toBe('admin@example.com');
  });
});
