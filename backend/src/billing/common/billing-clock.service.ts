import { Injectable } from '@nestjs/common';
import { ClockService } from 'src/common/clock/clock.service';
import { addDays } from 'src/common/clock/tz.util';

/** One consistent reading of the clinic clock for a whole operation. */
export interface ClinicTime {
  readonly now: Date;
  /** Location-local `YYYY-MM-DD`. */
  readonly today: string;
  readonly tz: string;
}

/**
 * Billing's view of `ClockService`: "now" and "today" in the location's
 * timezone, read once per operation so every row written by it agrees.
 */
@Injectable()
export class BillingClock {
  constructor(private readonly clock: ClockService) {}

  async read(locationId: string): Promise<ClinicTime> {
    const tz = await this.clock.timezoneFor(locationId);
    const now = this.clock.now();
    return { now, tz, today: this.clock.today(tz, now) };
  }

  /** Clinic date of an instant. */
  dateOf(tz: string, at: Date): string {
    return this.clock.today(tz, at);
  }

  /** UTC range [start of `from`, start of the day after `to`). */
  range(tz: string, from: string, to: string): { start: Date; end: Date } {
    return {
      start: this.clock.dayRange(tz, from).start,
      end: this.clock.dayRange(tz, addDays(to, 1)).start,
    };
  }

  addDays(ymd: string, days: number): string {
    return addDays(ymd, days);
  }
}
