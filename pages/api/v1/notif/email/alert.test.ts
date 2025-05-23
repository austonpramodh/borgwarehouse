import { getServerSession } from 'next-auth/next';
import { createMocks } from 'node-mocks-http';
import handler from '~/pages/api/v1/notif/email/alert';
import { ConfigService } from '~/services';

vi.mock('next-auth/next');
vi.mock('~/services');

describe('Get Email Alert API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should return 405 if the method is not GET', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { name: 'testuser' },
    });
    const { req, res } = createMocks({ method: 'POST' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it('should return 401 if the user is not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it('should return 400 if the user does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { name: 'nonexistent' },
    });

    vi.mocked(ConfigService.getUsersList).mockResolvedValue([
      {
        id: 1,
        username: 'testuser',
        email: 'testuser@example.com',
        password: 'hashedpassword',
        roles: ['user'],
        emailAlert: true,
      },
    ]);

    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({
      message: 'User is incorrect. Please, logout to update your session.',
    });
  });

  it('should return emailAlert if the user exists', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { name: 'testuser' },
    });

    vi.mocked(ConfigService.getUsersList).mockResolvedValue([
      {
        id: 1,
        username: 'testuser',
        email: 'testuser@example.com',
        password: 'hashedpassword',
        roles: ['user'],
        emailAlert: true,
      },
    ]);

    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({
      emailAlert: true,
    });
  });

  it('should return 500 if there is an error reading the file', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { name: 'testuser' },
    });

    vi.mocked(ConfigService.getUsersList).mockImplementation(() => {
      throw new Error();
    });

    const { req, res } = createMocks({ method: 'GET' });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({
      status: 500,
      message: 'API error, contact the administrator',
    });
  });
});

describe('Update email Alert API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should return 401 if not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const { req, res } = createMocks({ method: 'PUT' });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
  });

  it('should return 405 if method is not PUT', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { name: 'testuser' },
    });
    const { req, res } = createMocks({ method: 'POST' });
    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
  });

  it('should return 422 if emailAlert is not a boolean', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { name: 'Lovelace' },
    });

    const { req, res } = createMocks({
      method: 'PUT',
      body: { emailAlert: 'yes' }, // incorrect type
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(422);
    expect(res._getJSONData()).toEqual({ message: 'Unexpected data' });
  });

  it('should return 400 if user is not found in the users list', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { name: 'Lovelace' },
    });

    vi.mocked(ConfigService.getUsersList).mockResolvedValue([
      {
        id: 2,
        username: 'Ada',
        email: 'ada@example.com',
        emailAlert: false,
        password: '',
        roles: [],
      },
    ]);

    const { req, res } = createMocks({
      method: 'PUT',
      body: { emailAlert: true },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(res._getJSONData()).toEqual({
      message: 'User is incorrect. Please, logout to update your session.',
    });
  });

  it('should update emailAlert and return 200 on success', async () => {
    const user = {
      id: 1,
      username: 'Lovelace',
      email: 'lovelace@example.com',
      emailAlert: false,
      password: '',
      roles: [],
    };

    vi.mocked(getServerSession).mockResolvedValue({
      user: { name: 'Lovelace' },
    });

    vi.mocked(ConfigService.getUsersList).mockResolvedValue([user]);
    vi.mocked(ConfigService.updateUsersList).mockResolvedValue();

    const { req, res } = createMocks({
      method: 'PUT',
      body: { emailAlert: true },
    });

    await handler(req, res);

    expect(ConfigService.updateUsersList).toHaveBeenCalledWith([{ ...user, emailAlert: true }]);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getJSONData()).toEqual({ message: 'Successful API send' });
  });

  it('should return 500 if there is a file system error (ENOENT)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { name: 'Lovelace' },
    });

    vi.mocked(ConfigService.getUsersList).mockRejectedValue({ code: 'ENOENT' });

    const { req, res } = createMocks({
      method: 'PUT',
      body: { emailAlert: true },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({
      status: 500,
      message: 'No such file or directory',
    });
  });

  it('should return 500 on unknown error', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { name: 'Lovelace' },
    });

    vi.mocked(ConfigService.getUsersList).mockRejectedValue({ code: 'UNKNOWN' });

    const { req, res } = createMocks({
      method: 'PUT',
      body: { emailAlert: true },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(res._getJSONData()).toEqual({
      status: 500,
      message: 'API error, contact the administrator',
    });
  });
});
