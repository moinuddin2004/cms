import { WORKFLOW_SEEDS } from '../seeds/dental-workflows.seed';
import { checkWorkflow, simulateWorkflow } from './workflow-definition.checker';
import type { WorkflowDefinition } from './workflow.types';

const EFFECTS = new Set(['recompute_order_status']);
const codes = (def: unknown) =>
  checkWorkflow(def, EFFECTS).issues.map((i) => i.code);

const tiny = (): WorkflowDefinition => ({
  states: [
    { code: 'new', name: 'New', category: 'initial' },
    { code: 'working', name: 'Working', category: 'active' },
    { code: 'done', name: 'Done', category: 'done' },
    { code: 'cancelled', name: 'Cancelled', category: 'cancelled' },
  ],
  transitions: [
    { from: 'new', action: 'start', to: 'working', allowedSides: ['clinic'] },
    { from: 'working', action: 'finish', to: 'done', allowedSides: ['lab'] },
    {
      from: 'new',
      action: 'cancel',
      to: 'cancelled',
      allowedSides: ['clinic'],
    },
  ],
});

describe('workflow definition checker', () => {
  it.each(WORKFLOW_SEEDS.map((w) => [w.code, w] as const))(
    'seed workflow %s is publishable',
    (_code, seed) => {
      expect(checkWorkflow(seed.definition, EFFECTS).issues).toEqual([]);
    },
  );

  it('accepts a minimal valid workflow', () => {
    expect(codes(tiny())).toEqual([]);
  });

  it('needs exactly one initial, a done and a cancelled state', () => {
    const def = tiny();
    def.states = def.states.filter((s) => s.category === 'active');
    def.transitions = [];
    expect(codes(def)).toEqual([
      'initial_state',
      'no_done_state',
      'no_cancelled_state',
      'dead_end',
    ]);
  });

  it('finds unreachable states and dead ends', () => {
    const def = tiny();
    def.states.push({ code: 'island', name: 'Island', category: 'waiting' });
    expect(codes(def)).toEqual(['unreachable_state', 'dead_end']);
  });

  it('rejects transitions out of terminal states', () => {
    const def = tiny();
    def.transitions.push({
      from: 'done',
      action: 'reopen',
      to: 'working',
      allowedSides: ['clinic'],
    });
    expect(codes(def)).toEqual(['from_terminal']);
  });

  it('one target per (state, action), except derived changes', () => {
    const def = tiny();
    def.transitions.push(
      { from: 'new', action: 'start', to: 'done', allowedSides: ['clinic'] },
      {
        from: 'working',
        action: 'derive',
        to: 'done',
        allowedSides: ['system'],
      },
      {
        from: 'working',
        action: 'derive',
        to: 'cancelled',
        allowedSides: ['system'],
      },
      { from: 'new', action: 'derive', to: 'done', allowedSides: ['clinic'] },
    );
    expect(codes(def)).toEqual(['duplicate_action', 'invalid_sides']);
  });

  it('only registered effects, real roles and known sides', () => {
    const def = tiny();
    def.transitions[0] = {
      ...def.transitions[0],
      allowedRoles: ['janitor'],
      effects: [{ code: 'send_fax' }],
    };
    def.transitions[1] = {
      ...def.transitions[1],
      allowedSides: ['patient' as 'lab'],
    };
    expect(codes(def)).toEqual([
      'unknown_role',
      'unknown_effect',
      'invalid_sides',
    ]);
  });

  it('rejects unknown states and malformed input', () => {
    const def = tiny();
    def.transitions.push({
      from: 'new',
      action: 'x',
      to: 'ghost',
      allowedSides: ['lab'],
    });
    expect(codes(def)).toEqual(['unknown_state']);
    expect(codes({ states: [] })).toEqual(['invalid_definition']);
  });
});

describe('workflow simulation (test run)', () => {
  it('walks the shortest path to every terminal state', () => {
    const item = WORKFLOW_SEEDS.find(
      (w) => w.code === 'DENTAL_ITEM',
    )!.definition;
    const runs = simulateWorkflow(item);
    const delivered = runs.find((r) => r.terminal === 'delivered')!;
    expect(delivered.path!.map((p) => p.action)).toEqual([
      'accept',
      'start',
      'finish',
      'qc_pass',
      'dispatch',
      'receive',
      'approve',
      'deliver',
    ]);
    expect(runs.every((r) => r.path !== null)).toBe(true);
  });

  it('reports unreachable terminals as null', () => {
    const def = tiny();
    def.transitions = def.transitions.filter((t) => t.to !== 'done');
    expect(
      simulateWorkflow(def).find((r) => r.terminal === 'done')!.path,
    ).toBeNull();
  });
});
