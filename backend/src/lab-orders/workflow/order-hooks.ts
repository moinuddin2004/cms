import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { ClinicCall } from '../common/order-context';
import type { LabOrder } from '../entities/lab-order.entity';

export type OrderSubmittedHook = (
  m: EntityManager,
  order: LabOrder,
  call: ClinicCall,
) => Promise<void>;

export type OrderStateHook = (
  m: EntityManager,
  orderId: string,
  toState: string,
) => Promise<void>;

/**
 * Lets modules built on orders (lab access: magic links) join an order's
 * transactions without this module importing them: submit (lab ERD §10
 * "zaroorat ho to magic_links") and every order status write (closing an
 * order revokes its magic links). Hooks run inside the caller's transaction.
 */
@Injectable()
export class OrderLifecycleHooks {
  private readonly submitted: OrderSubmittedHook[] = [];
  private readonly stateChanged: OrderStateHook[] = [];

  onSubmitted(hook: OrderSubmittedHook): void {
    this.submitted.push(hook);
  }

  onStateChanged(hook: OrderStateHook): void {
    this.stateChanged.push(hook);
  }

  async runSubmitted(
    m: EntityManager,
    order: LabOrder,
    call: ClinicCall,
  ): Promise<void> {
    for (const hook of this.submitted) await hook(m, order, call);
  }

  async runStateChanged(
    m: EntityManager,
    orderId: string,
    toState: string,
  ): Promise<void> {
    for (const hook of this.stateChanged) await hook(m, orderId, toState);
  }
}
