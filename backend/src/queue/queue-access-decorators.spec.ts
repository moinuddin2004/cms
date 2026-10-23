import { Reflector } from '@nestjs/core';
import { METHOD_METADATA } from '@nestjs/common/constants';
import {
  ANY_MEMBER_KEY,
  CAN_KEY,
} from 'src/access/decorators/access.decorators';
import { isPermission } from 'src/access/catalog/permissions';
import { IS_PUBLIC_KEY } from 'src/common/decorators/publicDecorator';
import { AppointmentsController } from 'src/appointments/appointments.controller';
import { EncountersController } from 'src/encounters/encounters.controller';
import { DisplayController } from './controllers/display.controller';
import { DoctorQueueController } from './controllers/doctor-queue.controller';
import { QueueController } from './controllers/queue.controller';

type Ctor = new (...args: never[]) => object;

const CONTROLLERS: Ctor[] = [
  QueueController,
  DoctorQueueController,
  DisplayController,
  AppointmentsController,
  EncountersController,
];

/** Route handlers on a controller (methods carrying a request method). */
function handlers(controller: Ctor) {
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor')
    .map((name) => ({ name, fn: proto[name] as object }))
    .filter(
      ({ fn }) =>
        typeof fn === 'function' &&
        Reflect.getMetadata(METHOD_METADATA, fn) !== undefined,
    );
}

describe('queue / appointments / consultation access decorators', () => {
  const reflector = new Reflector();

  for (const controller of CONTROLLERS) {
    describe(controller.name, () => {
      const routes = handlers(controller);

      it('has route handlers', () => {
        expect(routes.length).toBeGreaterThan(0);
      });

      it.each(routes.map((r) => [r.name, r.fn] as const))(
        '%s has @Can, @AnyMember or @Public',
        (_name, fn) => {
          const targets = [fn as () => void, controller];
          const perms = reflector.getAllAndMerge<string[]>(CAN_KEY, targets);
          const anyMember = reflector.getAllAndOverride<boolean>(
            ANY_MEMBER_KEY,
            targets,
          );
          const isPublic = reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            targets,
          );
          expect(!!perms?.length || !!anyMember || !!isPublic).toBe(true);
          for (const p of perms ?? []) expect(isPermission(p)).toBe(true);
        },
      );
    });
  }

  it('only the TV display is public', () => {
    const publicOnes = CONTROLLERS.filter((c) =>
      handlers(c).some(({ fn }) =>
        reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
          fn as () => void,
          c,
        ]),
      ),
    );
    expect(publicOnes).toEqual([DisplayController]);
  });
});
