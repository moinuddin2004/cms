/** Which party performed an action. `platform` = super admin (our team). */
export enum ActorSide {
  CLINIC = 'clinic',
  LAB = 'lab',
  PLATFORM = 'platform',
  SYSTEM = 'system',
}

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  VOID = 'void',
  /** Hard delete: `changes.before` keeps the last state of the row. */
  DELETE = 'delete',
  EXPORT = 'export',
  VIEW_SENSITIVE = 'view_sensitive',
}

/** The channel a status change came through (lab ERD §7). */
export enum TransitionVia {
  APP = 'app',
  PORTAL = 'portal',
  MAGIC_LINK = 'magic_link',
  PROXY = 'proxy',
  QR = 'qr',
}

/**
 * Who is acting, for audit rows. Built once per request (see
 * `@RequestActor()`), then passed down to every service that writes history.
 */
export interface ActorRef {
  /** Null only for system jobs. */
  userId: string | null;
  side: ActorSide;
  ip?: string | null;
  requestId?: string | null;
}
