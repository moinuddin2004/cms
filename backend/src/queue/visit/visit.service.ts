import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ClockService } from 'src/common/clock/clock.service';
import { QueueEntry } from '../entities/queue-entry.entity';
import { QueueSession } from '../entities/queue-session.entity';
import { QueuePositionService } from '../services/queue-position.service';
import { QueueErrors } from '../queue.errors';
import {
  VISIT_TOKEN_PATTERN,
  VISIT_TOKEN_TTL_HOURS,
  generateVisitToken,
  hashVisitToken,
} from './visit-token';

export interface VisitState {
  clinicName: string;
  locationName: string;
  token: string;
  status: string;
  peopleAhead: number | null;
  nowServingToken: string | null;
  updatedAt: string;
}

const NOT_FOUND = () =>
  new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });

/** Visit tokens (M3-05): the clinic shares a link to one queue entry; the public page reads its state. */
@Injectable()
export class VisitService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly positions: QueuePositionService,
    private readonly clock: ClockService,
    private readonly config: ConfigService,
  ) {}

  /** Staff: mint a link for an entry of the active location. The raw token is returned once. */
  async createLink(
    organizationId: string,
    locationId: string,
    entryId: string,
  ): Promise<{ url: string; expiresAt: string }> {
    const entry = await this.dataSource.getRepository(QueueEntry).findOne({
      where: { id: entryId, organizationId },
      select: { id: true, queueSessionId: true },
    });
    const session = entry
      ? await this.dataSource.getRepository(QueueSession).findOne({
          where: { id: entry.queueSessionId },
          select: { id: true, locationId: true },
        })
      : null;
    if (!entry || !session || session.locationId !== locationId) {
      throw QueueErrors.notFound('Queue entry');
    }
    const token = generateVisitToken();
    const expiresAt = new Date(
      this.clock.now().getTime() + VISIT_TOKEN_TTL_HOURS * 3_600_000,
    );
    await this.dataSource.query(
      `DELETE FROM queue_visit_tokens WHERE expires_at < now()`,
    );
    await this.dataSource.query(
      `INSERT INTO queue_visit_tokens (organization_id, entry_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [organizationId, entryId, hashVisitToken(token), expiresAt],
    );
    const base = (this.config.get<string>('FRONTEND_URL') ?? '').replace(
      /\/+$/,
      '',
    );
    return { url: `${base}/v/${token}`, expiresAt: expiresAt.toISOString() };
  }

  /** Public: the state behind a token. One generic 404 for anything wrong. */
  async state(token: string): Promise<VisitState> {
    if (!VISIT_TOKEN_PATTERN.test(token)) throw NOT_FOUND();
    const rows: { entry_id: string }[] = await this.dataSource.query(
      `SELECT t.entry_id
         FROM queue_visit_tokens t
         JOIN organizations o ON o.id = t.organization_id
        WHERE t.token_hash = $1 AND t.expires_at > now()
          AND o.approval_status = 'approved'`,
      [hashVisitToken(token)],
    );
    if (!rows[0]) throw NOT_FOUND();
    const [pos] = await this.positions.positions([rows[0].entry_id]);
    if (!pos) throw NOT_FOUND();
    const names: { clinic: string; location: string }[] =
      await this.dataSource.query(
        `SELECT o.name AS clinic, l.name AS location
           FROM organizations o, locations l
          WHERE o.id = $1 AND l.id = $2`,
        [pos.organizationId, pos.locationId],
      );
    return {
      clinicName: names[0]?.clinic ?? '',
      locationName: names[0]?.location ?? '',
      token: pos.token,
      status: pos.status,
      peopleAhead: pos.peopleAhead,
      nowServingToken: pos.nowServingToken,
      updatedAt: this.clock.now().toISOString(),
    };
  }
}
