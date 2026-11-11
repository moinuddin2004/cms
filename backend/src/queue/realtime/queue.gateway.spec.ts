import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AuthorizationService } from 'src/auth/services/authorization.service';
import { QueueGateway } from './queue.gateway';

function fakeSocket(token?: string) {
  return {
    handshake: { auth: token ? { token } : {} },
    data: {} as { userId: string | null },
    join: jest.fn().mockResolvedValue(undefined),
    emit: jest.fn(),
  };
}

describe('QueueGateway — staff audience on connect', () => {
  let verifyAsync: jest.Mock;
  let gateway: QueueGateway;

  beforeEach(() => {
    verifyAsync = jest.fn();
    gateway = new QueueGateway(
      { verifyAsync } as unknown as JwtService,
      { get: () => 'test-access-secret' } as unknown as ConfigService,
      {} as AuthorizationService,
      {} as DataSource,
    );
  });

  it('accepts a token with aud "staff" and joins the user room', async () => {
    verifyAsync.mockResolvedValue({ sub: 'user-1', aud: 'staff' });
    const socket = fakeSocket('staff-token');

    await gateway.handleConnection(socket as never);

    expect(socket.data.userId).toBe('user-1');
    expect(socket.join).toHaveBeenCalledWith('user:user-1');
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('accepts a legacy token with no aud (transition window)', async () => {
    verifyAsync.mockResolvedValue({ sub: 'user-2' });
    const socket = fakeSocket('legacy-token');

    await gateway.handleConnection(socket as never);

    expect(socket.data.userId).toBe('user-2');
    expect(socket.join).toHaveBeenCalledWith('user:user-2');
  });

  it('rejects a patient token: no user room, auth_error emitted', async () => {
    verifyAsync.mockResolvedValue({ sub: 'patient-1', aud: 'patient' });
    const socket = fakeSocket('patient-token');

    await gateway.handleConnection(socket as never);

    expect(socket.data.userId).toBeNull();
    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('auth_error', {
      message: 'Invalid or expired token',
    });
  });

  it('lets the display screen connect anonymously', async () => {
    const socket = fakeSocket();

    await gateway.handleConnection(socket as never);

    expect(verifyAsync).not.toHaveBeenCalled();
    expect(socket.data.userId).toBeNull();
    expect(socket.join).not.toHaveBeenCalled();
  });
});
