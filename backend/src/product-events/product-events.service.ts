import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ProductEventDto } from './dto/product-events.dto';
import { ProductEvent } from './entities/product-event.entity';
import {
  MAX_EVENT_AGE_MS,
  PRODUCT_EVENTS,
  ProductEventActor,
  ProductEventSpec,
  VERSION_RE,
} from './product-event-catalog';

/** Keep only allow-listed props with allowed scalar values. */
export function sanitizeProps(
  spec: ProductEventSpec,
  raw: Record<string, unknown> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, allowed] of Object.entries(spec.props)) {
    const value = raw[key];
    if (typeof value !== 'string' && typeof value !== 'boolean') continue;
    const text = String(value);
    const ok =
      allowed === 'version' ? VERSION_RE.test(text) : allowed.includes(text);
    if (ok) out[key] = text;
  }
  return out;
}

function clampAt(at: string | undefined, now: Date): Date {
  if (!at) return now;
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return now;
  if (t > now.getTime() || now.getTime() - t > MAX_EVENT_AGE_MS) return now;
  return new Date(t);
}

@Injectable()
export class ProductEventsService {
  constructor(
    @InjectRepository(ProductEvent)
    private readonly events: Repository<ProductEvent>,
  ) {}

  /**
   * Store the valid events of a batch; unknown names / other-space names are
   * dropped (never an error: analytics must not break the app).
   */
  async record(
    actor: ProductEventActor,
    actorId: string,
    organizationId: string | null,
    batch: ProductEventDto[],
    now: Date = new Date(),
  ): Promise<{ accepted: number }> {
    const rows: Partial<ProductEvent>[] = [];
    for (const e of batch) {
      const spec = (PRODUCT_EVENTS as Record<string, ProductEventSpec>)[e.name];
      if (!spec || spec.actor !== actor) continue;
      rows.push({
        actorType: actor,
        actorId,
        organizationId,
        name: e.name,
        props: sanitizeProps(spec, e.props),
        at: clampAt(e.at, now),
      });
    }
    if (rows.length) await this.events.insert(rows);
    return { accepted: rows.length };
  }
}
