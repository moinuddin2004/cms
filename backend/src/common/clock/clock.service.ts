import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from 'src/locations/entities/location.entity';
import {
  localDate,
  localDayRange,
  localHHMM,
  localParts,
  safeTimezone,
  zonedTimeToUtc,
} from './tz.util';

const TZ_CACHE_MS = 60_000;

/**
 * Single source of "now" and "today" for clinic logic.
 *
 * Everything clinic-facing — working hours, availability, the same-day
 * duplicate guard, the queue's day boundary, token days — is computed in the
 * LOCATION's timezone through this service, never with `new Date()` +
 * `setHours()` (which use the server's timezone). Tests can stub `now()`.
 */
@Injectable()
export class ClockService {
  private readonly tzCache = new Map<string, { tz: string; at: number }>();

  constructor(
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
  ) {}

  now(): Date {
    return new Date();
  }

  /** The location's IANA timezone (falls back to UTC), cached for 60 s. */
  async timezoneFor(locationId: string): Promise<string> {
    const hit = this.tzCache.get(locationId);
    if (hit && Date.now() - hit.at < TZ_CACHE_MS) return hit.tz;

    const location = await this.locationRepo.findOne({
      where: { id: locationId },
      select: ['id', 'timezone'],
    });
    const tz = safeTimezone(location?.timezone);
    this.tzCache.set(locationId, { tz, at: Date.now() });
    return tz;
  }

  /** Location-local "YYYY-MM-DD" for `at` (default: now). */
  today(tz: string, at: Date = this.now()): string {
    return localDate(tz, at);
  }

  /** Location-local weekday (0 = Sunday) and "HH:MM" of an instant. */
  wallClock(tz: string, at: Date): { dayOfWeek: number; hhmm: string } {
    return { dayOfWeek: localParts(tz, at).dayOfWeek, hhmm: localHHMM(tz, at) };
  }

  /** Half-open UTC range [start, end) of a location-local day. */
  dayRange(tz: string, ymd: string): { start: Date; end: Date } {
    return localDayRange(tz, ymd);
  }

  /** The instant when the location's wall clock reads `ymd` `hhmm`. */
  at(tz: string, ymd: string, hhmm: string): Date {
    return zonedTimeToUtc(tz, ymd, hhmm);
  }
}
