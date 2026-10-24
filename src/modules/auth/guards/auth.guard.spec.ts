jest.mock('../auth.service', () => ({
  AuthService: class {},
}));

jest.mock('../jwt.service', () => ({
  JwtService: class {},
}));

import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  it('refreshes tokens when the access token is missing and a refresh token cookie exists', async () => {
    const authService = {
      refresh: jest.fn().mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      }),
    };
    const jwtService = {
      verifyAccessToken: jest.fn((token: string) => {
        if (token === 'new-access') {
          return { sub: 'user-1', email: 'user@example.com' };
        }

        throw new Error('expired');
      }),
      verifyRefreshToken: jest.fn(() => ({ sub: 'user-1', email: 'user@example.com' })),
    };

    const guard = new AuthGuard(authService as never, jwtService as never);
    const request = {
      headers: {
        cookie: 'refresh_token=refresh-token-value',
      },
    };
    const response = {
      cookie: jest.fn(),
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as never;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authService.refresh).toHaveBeenCalledWith(
      { refreshToken: 'refresh-token-value' },
      undefined,
      undefined,
    );
    expect(response.cookie).toHaveBeenCalled();
  });
});
