import { Injectable } from '@nestjs/common';
import type { CompiledTransition } from './compiled-workflow';
import type {
  AdapterContext,
  SubjectAdapter,
  TransitionRequest,
  WorkflowSubject,
} from './runtime.types';

export interface EffectContext extends AdapterContext {
  subject: WorkflowSubject;
  adapter: SubjectAdapter;
  transition: CompiledTransition;
  request: TransitionRequest;
  params: Record<string, unknown>;
}

/**
 * A side effect a transition may run (lab ERD §17). Handlers are code;
 * workflows only choose which run, in which order, with which params.
 * Financial handlers validate their own preconditions — config can't skip it.
 */
export interface EffectHandler {
  code: string;
  description: string;
  isFinancial: boolean;
  run(ctx: EffectContext): Promise<void>;
}

/** In-memory registry; synced to `workflow_effects` on boot. */
@Injectable()
export class EffectRegistry {
  private readonly handlers = new Map<string, EffectHandler>();

  register(handler: EffectHandler): void {
    if (this.handlers.has(handler.code)) {
      throw new Error(`Effect ${handler.code} registered twice`);
    }
    this.handlers.set(handler.code, handler);
  }

  get(code: string): EffectHandler | undefined {
    return this.handlers.get(code);
  }

  all(): EffectHandler[] {
    return [...this.handlers.values()];
  }

  codes(): ReadonlySet<string> {
    return new Set(this.handlers.keys());
  }
}
