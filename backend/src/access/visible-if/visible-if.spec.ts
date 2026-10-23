import { lastValueFrom, of } from 'rxjs';
import { ExecutionContext, StreamableFile } from '@nestjs/common';
import {
  stripHiddenFields,
  VisibleIf,
  VisibleIfInterceptor,
  visibleIfFields,
} from './visible-if';
import type { Permission } from '../catalog/permissions';

class TreatmentDto {
  name = 'Filling';

  @VisibleIf('patients.price.view')
  price = 500;
}

class DiscountedTreatmentDto extends TreatmentDto {
  @VisibleIf('billing.discount.apply')
  discount = 50;
}

const can =
  (...held: Permission[]) =>
  (p: Permission) =>
    held.includes(p);

describe('@VisibleIf', () => {
  it('collects rules including inherited ones', () => {
    expect([...visibleIfFields(DiscountedTreatmentDto).entries()]).toEqual([
      ['price', 'patients.price.view'],
      ['discount', 'billing.discount.apply'],
    ]);
  });

  it('strips fields the caller may not see, deep inside the response', () => {
    const body = {
      data: {
        items: [new TreatmentDto(), new DiscountedTreatmentDto()],
        plain: { price: 1 },
      },
    };
    stripHiddenFields(body, can('billing.discount.apply'));
    expect(body.data.items[0]).toEqual({ name: 'Filling' });
    expect(body.data.items[1]).toEqual({ name: 'Filling', discount: 50 });
    // object literals are not recognised
    expect(body.data.plain).toEqual({ price: 1 });
  });

  it('keeps fields when the permission is held', () => {
    const dto = new TreatmentDto();
    stripHiddenFields(dto, can('patients.price.view'));
    expect(dto.price).toBe(500);
  });

  it('survives cycles and leaves files/dates alone', () => {
    const a: Record<string, unknown> = {
      when: new Date(0),
      file: new StreamableFile(Buffer.from('x')),
    };
    a.self = a;
    expect(() => stripHiddenFields(a, can())).not.toThrow();
    expect(a.when).toEqual(new Date(0));
  });

  it('interceptor hides fields without an access context (fail-closed)', async () => {
    const run = async (req: Record<string, unknown>) => {
      const context = {
        getType: () => 'http',
        switchToHttp: () => ({ getRequest: () => req }),
      } as unknown as ExecutionContext;
      const body = { data: new TreatmentDto() };
      return lastValueFrom(
        new VisibleIfInterceptor().intercept(context, {
          handle: () => of(body),
        }),
      ) as Promise<{ data: TreatmentDto }>;
    };
    expect((await run({})).data.price).toBeUndefined();
    const allowed = {
      access: { can: (p: string) => p === 'patients.price.view' },
    };
    expect((await run(allowed)).data.price).toBe(500);
  });
});
