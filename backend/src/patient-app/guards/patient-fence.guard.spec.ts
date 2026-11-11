import {
  Controller,
  ForbiddenException,
  Get,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PatientApi,
  PatientAuthRoute,
} from '../decorators/patient-api.decorator';
import { PatientFenceGuard } from './patient-fence.guard';

@PatientApi()
@Controller('patient-api/fenced')
class FencedPatientController {
  @Get()
  read(): void {}
}

@Controller('patient-api')
class UnfencedPatientController {
  @Get('x')
  read(): void {}
}

@PatientAuthRoute()
@Controller('patient-auth/fenced')
class FencedAuthController {
  @Get()
  start(): void {}
}

@Controller('patient-auth')
class UnfencedAuthController {
  @Get('x')
  start(): void {}
}

@PatientApi()
@Controller('patients')
class MisplacedPatientController {
  @Get()
  read(): void {}
}

@Controller('patients')
class StaffController {
  @Get()
  list(): void {}
}

const guard = new PatientFenceGuard(new Reflector());

/** The raw prototype method — the guard reads metadata off this exact function. */
function methodOf(controller: object, name: string): () => void {
  const fn = (controller as { prototype: Record<string, unknown> }).prototype[
    name
  ];
  return fn as () => void;
}

function httpContext(
  handler: () => void,
  controller: object,
  request: { path?: string; url?: string },
): ExecutionContext {
  return {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function fenceError(context: ExecutionContext): ForbiddenException {
  try {
    guard.canActivate(context);
  } catch (error) {
    expect(error).toBeInstanceOf(ForbiddenException);
    return error as ForbiddenException;
  }
  throw new Error('expected PatientFenceGuard to throw');
}

function expectFence(context: ExecutionContext): void {
  const body = fenceError(context).getResponse() as { code: string };
  expect(body.code).toBe('PATIENT_FENCE');
}

describe('PatientFenceGuard', () => {
  it('lets a @PatientApi() route through', () => {
    expect(
      guard.canActivate(
        httpContext(
          methodOf(FencedPatientController, 'read'),
          FencedPatientController,
          { path: '/patient-api/fenced' },
        ),
      ),
    ).toBe(true);
  });

  it('lets a @PatientAuthRoute() route through', () => {
    expect(
      guard.canActivate(
        httpContext(
          methodOf(FencedAuthController, 'start'),
          FencedAuthController,
          { path: '/patient-auth/fenced' },
        ),
      ),
    ).toBe(true);
  });

  it('403s a /patient-api route that forgot @PatientApi() (dummy controller)', () => {
    expectFence(
      httpContext(
        methodOf(UnfencedPatientController, 'read'),
        UnfencedPatientController,
        { path: '/patient-api/x' },
      ),
    );
  });

  it('403s a /patient-auth route that forgot @PatientAuthRoute()', () => {
    expectFence(
      httpContext(
        methodOf(UnfencedAuthController, 'start'),
        UnfencedAuthController,
        { path: '/patient-auth/x' },
      ),
    );
  });

  it('403s patient metadata on a non-patient path', () => {
    expectFence(
      httpContext(
        methodOf(MisplacedPatientController, 'read'),
        MisplacedPatientController,
        { path: '/patients' },
      ),
    );
  });

  it('403s @PatientAuthRoute() on a /patient-api path', () => {
    expectFence(
      httpContext(
        methodOf(FencedAuthController, 'start'),
        FencedAuthController,
        {
          path: '/patient-api/fenced',
        },
      ),
    );
  });

  it('ignores the query string when only request.url is available', () => {
    expectFence(
      httpContext(
        methodOf(UnfencedPatientController, 'read'),
        UnfencedPatientController,
        { url: '/patient-api/x?token=1' },
      ),
    );
  });

  it('lets a staff route with neither decorator through', () => {
    expect(
      guard.canActivate(
        httpContext(methodOf(StaffController, 'list'), StaffController, {
          path: '/patients',
        }),
      ),
    ).toBe(true);
  });

  it('passes non-http contexts', () => {
    expect(
      guard.canActivate({
        getType: () => 'ws',
      } as unknown as ExecutionContext),
    ).toBe(true);
  });
});
