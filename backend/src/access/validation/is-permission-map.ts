import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { validatePermissionMap } from '../catalog/permissions';

/**
 * A role permission map: catalog keys only; scoped permissions take one of
 * their scopes, the rest take `true`.
 */
export function IsPermissionMap(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isPermissionMap',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => validatePermissionMap(value) === null,
        defaultMessage: (args: ValidationArguments) =>
          `${args.property}: ${validatePermissionMap(args.value) ?? 'invalid'}`,
      },
    });
}
