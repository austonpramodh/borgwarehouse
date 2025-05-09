import handler from '~/pages/api/v1/cron/storage';
import { createMocks } from 'node-mocks-http';
import { ConfigService, ShellService } from '~/services';
import { Repository } from '~/types';

vi.mock('~/services');

describe('GET /api/cronjob/getStorageUsed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  const CRONJOB_KEY = 'test-cronjob-key';
  process.env.CRONJOB_KEY = CRONJOB_KEY;

  it('should return unauthorized if no authorization header is provided', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
  });

  it('should return unauthorized if the authorization key is invalid', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        authorization: 'Bearer invalid-key',
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
  });

  it('should return success if no repositories are found', async () => {
    vi.mocked(ConfigService.getRepoList).mockResolvedValue([]);

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        authorization: `Bearer ${CRONJOB_KEY}`,
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getData()).toContain('No repository to check');
  });

  it('should update repositories with storage used and return success', async () => {
    const mockRepoList = [
      { repositoryName: 'repo1', storageUsed: 0 },
      { repositoryName: 'repo2', storageUsed: 0 },
    ] as Repository[];
    const mockStorageUsed = [
      { name: 'repo1', size: 100 },
      { name: 'repo2', size: 200 },
    ];

    vi.mocked(ConfigService.getRepoList).mockResolvedValue(mockRepoList);
    vi.mocked(ShellService.getStorageUsed).mockResolvedValue(mockStorageUsed);
    vi.mocked(ConfigService.updateRepoList).mockResolvedValue(undefined);

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        authorization: `Bearer ${CRONJOB_KEY}`,
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getData()).toContain('Storage cron executed successfully');
    expect(ConfigService.updateRepoList).toHaveBeenCalledWith([
      { repositoryName: 'repo1', storageUsed: 100 },
      { repositoryName: 'repo2', storageUsed: 200 },
    ]);
  });

  it('should return server error if an exception occurs', async () => {
    vi.mocked(ConfigService.getRepoList).mockRejectedValue(new Error('Test error'));

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        authorization: `Bearer ${CRONJOB_KEY}`,
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
  });

  it('should not touch to a repository if it is not found in the storage used list', async () => {
    const mockRepoList = [
      { repositoryName: 'repo1', storageUsed: 0 },
      { repositoryName: 'repo2', storageUsed: 0 },
    ] as Repository[];
    const mockStorageUsed = [{ name: 'repo1', size: 100 }];

    vi.mocked(ConfigService.getRepoList).mockResolvedValue(mockRepoList);
    vi.mocked(ShellService.getStorageUsed).mockResolvedValue(mockStorageUsed);
    vi.mocked(ConfigService.updateRepoList).mockResolvedValue(undefined);

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        authorization: `Bearer ${CRONJOB_KEY}`,
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(ConfigService.updateRepoList).toHaveBeenCalledWith([
      { repositoryName: 'repo1', storageUsed: 100 },
      { repositoryName: 'repo2', storageUsed: 0 },
    ]);
  });
});
