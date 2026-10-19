import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { FormCompare } from './components/FormCompare'
import { FormVersionEditor } from './components/FormVersionEditor'
import { WorkflowVersionEditor } from './components/WorkflowVersionEditor'
import { diffForm, diffWorkflow } from './lib/diff'
import { answersToSend, sectionsFor, visibleKeys } from './lib/form-preview'
import {
  issuesByRow,
  normalizeDefinition,
  removeState,
  updateState,
  updateTransition,
} from './lib/workflow-edit'
import { FormSchemasPage } from './pages/DefinitionsListPage'
import { StageTemplatesPage } from './pages/StageTemplatesPage'
import type {
  FieldDef,
  FormSchemaDetail,
  FormVersion,
  StageTemplate,
  WorkflowTemplateDetail,
  WorkflowVersion,
} from './types'

// ── Mocks: API transport, router, toasts, page chrome ────────────────────
const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/lib/api', () => ({ default: api, apiClient: api }))
const navigate = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigate,
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({
    title,
    actions,
    children,
  }: {
    title?: string
    actions?: ReactNode
    children: ReactNode
  }) => (
    <main>
      <h1>{title}</h1>
      {actions}
      {children}
    </main>
  ),
}))

const ok = <T,>(data: T) => ({ data: { data } })

function renderWithClient(ui: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Fixtures ─────────────────────────────────────────────────────────────

const shadeFields: FieldDef[] = [
  { key: 'teeth', type: 'tooth_chart', label: 'Teeth', required: true },
  {
    key: 'shade_system',
    type: 'select',
    label: 'Shade guide',
    options: [
      { value: 'VITA_classical', label: 'VITA classical' },
      { value: 'VITA_3D_master', label: 'VITA 3D-Master' },
    ],
    defaultValue: 'VITA_classical',
  },
  {
    key: 'shade',
    type: 'select',
    label: 'Shade',
    options: [{ value: 'A1', label: 'A1' }],
    visibleIf: { field: 'shade_system', in: ['VITA_classical'] },
  },
  {
    key: 'shade_3d',
    type: 'text',
    label: 'Shade (3D-Master)',
    visibleIf: { field: 'shade_system', in: ['VITA_3D_master'] },
  },
  { key: 'rush', type: 'boolean', label: 'Rush case' },
]

const schema = (over: Partial<FormSchemaDetail> = {}): FormSchemaDetail => ({
  id: 'form-1',
  specialty: { id: 'sp-1', code: 'DENTAL', name: 'Dental' },
  organization: null,
  code: 'CROWN',
  name: 'Crown',
  description: null,
  isActive: true,
  current: { id: 'v1', versionNo: 1, publishedAt: '2026-10-01T10:00:00Z' },
  draft: { id: 'v2', versionNo: 2 },
  version: 1,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  versions: [
    {
      id: 'v1',
      versionNo: 1,
      status: 'published',
      publishedAt: '2026-10-01T10:00:00Z',
      retiredAt: null,
      createdAt: '2026-10-01T10:00:00Z',
    },
    {
      id: 'v2',
      versionNo: 2,
      status: 'draft',
      publishedAt: null,
      retiredAt: null,
      createdAt: '2026-10-02T10:00:00Z',
    },
  ],
  ...over,
})

const formVersion = (over: Partial<FormVersion> = {}): FormVersion => ({
  id: 'v2',
  formSchemaId: 'form-1',
  versionNo: 2,
  status: 'draft',
  schemaJson: { fields: shadeFields },
  uiJson: null,
  promotions: { shade: 'dental_item_details.shade' },
  publishedAt: null,
  retiredAt: null,
  version: 3,
  createdAt: '2026-10-02T10:00:00Z',
  updatedAt: '2026-10-02T10:00:00Z',
  issues: [],
  ...over,
})

const definition = {
  states: [
    { code: 'pending', name: 'Pending', category: 'initial' as const },
    { code: 'accepted', name: 'Accepted', category: 'active' as const },
    { code: 'done', name: 'Done', category: 'done' as const },
    { code: 'cancelled', name: 'Cancelled', category: 'cancelled' as const },
  ],
  transitions: [
    {
      from: 'pending',
      to: 'accepted',
      action: 'accept',
      allowedSides: ['lab' as const],
    },
    {
      from: 'accepted',
      to: 'done',
      action: 'finish',
      allowedSides: ['lab' as const],
      effects: [{ code: 'recompute_order_status' }],
    },
    {
      from: 'pending',
      to: 'cancelled',
      action: 'cancel',
      allowedSides: ['clinic' as const],
      requiresReason: true,
    },
  ],
}

const template = (): WorkflowTemplateDetail => ({
  id: 'wf-1',
  specialty: { id: 'sp-1', code: 'DENTAL', name: 'Dental' },
  organization: null,
  entityType: 'item',
  code: 'DENTAL_ITEM',
  name: 'Dental item',
  description: null,
  isActive: true,
  current: { id: 'w1', versionNo: 1, publishedAt: '2026-10-01T10:00:00Z' },
  draft: { id: 'w2', versionNo: 2 },
  version: 1,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  versions: [],
})

const workflowVersion = (
  over: Partial<WorkflowVersion> = {},
): WorkflowVersion => ({
  id: 'w2',
  workflowTemplateId: 'wf-1',
  versionNo: 2,
  status: 'draft',
  definition,
  publishedAt: null,
  retiredAt: null,
  version: 5,
  createdAt: '2026-10-02T10:00:00Z',
  updatedAt: '2026-10-02T10:00:00Z',
  issues: [],
  simulation: [
    {
      terminal: 'done',
      path: [
        { from: 'pending', action: 'accept', to: 'accepted' },
        { from: 'accepted', action: 'finish', to: 'done' },
      ],
    },
    { terminal: 'cancelled', path: null },
  ],
  ...over,
})

// ── Pure helpers ─────────────────────────────────────────────────────────

describe('form preview helpers', () => {
  it('visibleIf follows the controlling answer, like the server', () => {
    expect([
      ...visibleKeys(shadeFields, { shade_system: 'VITA_classical' }),
    ]).toEqual(['teeth', 'shade_system', 'shade', 'rush'])
    expect([
      ...visibleKeys(shadeFields, { shade_system: 'VITA_3D_master' }),
    ]).toEqual(['teeth', 'shade_system', 'shade_3d', 'rush'])
    // No answer for the controller → neither dependent field shows.
    expect(visibleKeys(shadeFields, {}).has('shade')).toBe(false)
  })

  it('a field hidden behind a hidden field stays hidden', () => {
    const fields: FieldDef[] = [
      { key: 'a', type: 'boolean', label: 'A' },
      {
        key: 'b',
        type: 'text',
        label: 'B',
        visibleIf: { field: 'a', in: [true] },
      },
      {
        key: 'c',
        type: 'text',
        label: 'C',
        visibleIf: { field: 'b', in: ['x'] },
      },
    ]
    expect(visibleKeys(fields, { a: false, b: 'x' }).has('c')).toBe(false)
    expect(visibleKeys(fields, { a: true, b: 'x' }).has('c')).toBe(true)
  })

  it('sends only visible, non-empty answers', () => {
    expect(
      answersToSend(shadeFields, {
        shade_system: 'VITA_classical',
        shade: 'A1',
        shade_3d: 'stale',
        rush: false,
        teeth: [],
      }),
    ).toEqual({ shade_system: 'VITA_classical', shade: 'A1', rush: false })
  })

  it('groups fields by ui sections, unlisted ones last', () => {
    const s = sectionsFor(shadeFields, {
      sections: [{ title: 'Shade', fields: ['shade_system', 'shade'] }],
    })
    expect(s.map((x) => x.title)).toEqual(['Shade', 'Other'])
    expect(s[1].fields.map((f) => f.key)).toEqual(['teeth', 'shade_3d', 'rush'])
  })
})

describe('workflow edit helpers', () => {
  const def = normalizeDefinition(definition)

  it('renaming a state code carries its transitions along', () => {
    const next = updateState(def, 1, { code: 'approved' })
    expect(next.transitions.map((t) => [t.from, t.to])).toEqual([
      ['pending', 'approved'],
      ['approved', 'done'],
      ['pending', 'cancelled'],
    ])
  })

  it('removing a state removes its transitions', () => {
    const next = removeState(def, 1)
    expect(next.states.map((s) => s.code)).not.toContain('accepted')
    expect(next.transitions).toHaveLength(1)
  })

  it('a derive edge is forced to the system side with no roles', () => {
    const next = updateTransition(def, 0, {
      action: 'derive',
      allowedRoles: ['doctor'],
    })
    expect(next.transitions[0].allowedSides).toEqual(['system'])
    expect(next.transitions[0].allowedRoles).toEqual([])
  })

  it('maps issue paths to rows', () => {
    const rows = issuesByRow([
      { path: 'states[2].code', code: 'x', message: 'bad state' },
      { path: 'transitions[0]', code: 'y', message: 'bad edge' },
      { path: 'states', code: 'z', message: 'no done state' },
    ])
    expect(rows.states.get(2)?.[0].message).toBe('bad state')
    expect(rows.transitions.get(0)?.[0].message).toBe('bad edge')
    expect(rows.general).toHaveLength(1)
  })
})

describe('version diff', () => {
  it('finds added, removed and changed fields and promotions', () => {
    const v1 = formVersion({ id: 'v1', versionNo: 1 })
    const v2 = formVersion({
      schemaJson: {
        fields: [
          { ...shadeFields[0], required: false },
          ...shadeFields.slice(1, 4),
          { key: 'margin', type: 'text', label: 'Margin' },
        ],
      },
      promotions: { shade: 'dental_item_details.shade_system' },
    })
    const d = diffForm(v1, v2)
    expect(d.fields.added.map((f) => f.key)).toEqual(['margin'])
    expect(d.fields.removed.map((f) => f.key)).toEqual(['rush'])
    expect(d.fields.changed).toEqual([
      {
        key: 'teeth',
        label: 'Teeth',
        changes: [{ prop: 'required', before: true, after: false }],
      },
    ])
    expect(d.promotions.changed[0].changes[0]).toMatchObject({
      prop: 'column',
      after: 'dental_item_details.shade_system',
    })
    expect(d.total).toBe(4)
  })

  it('identical versions have no changes, whatever the key order', () => {
    const v1 = formVersion()
    const v2 = formVersion({
      schemaJson: {
        // Same fields, keys in reverse order.
        fields: shadeFields.map(
          (f) => Object.fromEntries(Object.entries(f).reverse()) as FieldDef,
        ),
      },
    })
    expect(diffForm(v1, v2).total).toBe(0)
  })

  it('finds workflow state and transition changes', () => {
    const v1 = workflowVersion({ id: 'w1', versionNo: 1 })
    const v2 = workflowVersion({
      definition: {
        states: [
          ...definition.states.slice(0, 3),
          { code: 'cancelled', name: 'Called off', category: 'cancelled' },
          { code: 'on_hold', name: 'On hold', category: 'waiting' },
        ],
        transitions: [
          ...definition.transitions.slice(0, 2),
          {
            from: 'pending',
            to: 'cancelled',
            action: 'cancel',
            allowedSides: ['clinic', 'lab'],
            requiresReason: true,
          },
        ],
      },
    })
    const d = diffWorkflow(v1, v2)
    expect(d.states.added.map((s) => s.code)).toEqual(['on_hold'])
    expect(d.states.changed[0]).toMatchObject({ key: 'cancelled' })
    expect(d.transitions.changed[0].changes).toEqual([
      { prop: 'allowedSides', before: ['clinic'], after: ['clinic', 'lab'] },
    ])
    // Absent optional lists equal empty ones — no false changes.
    expect(d.total).toBe(3)
  })
})

// ── Screens ──────────────────────────────────────────────────────────────

describe('FormSchemasPage', () => {
  it('lists forms and sends the owner filter to the API', async () => {
    api.get.mockImplementation((url: string) =>
      Promise.resolve(
        ok(
          url === '/platform/specialties'
            ? [
                {
                  id: 'sp-1',
                  code: 'DENTAL',
                  name: 'Dental',
                  isActive: true,
                  enabledByDefault: true,
                  version: 1,
                },
              ]
            : [schema()],
        ),
      ),
    )
    renderWithClient(<FormSchemasPage />)

    expect(await screen.findByText('Crown')).toBeTruthy()
    expect(screen.getByText('v1 published')).toBeTruthy()
    expect(screen.getByText('v2 draft')).toBeTruthy()

    fireEvent.click(screen.getByRole('combobox', { name: 'Filter by owner' }))
    fireEvent.click(
      await screen.findByRole('option', { name: 'Platform defaults' }),
    )
    await waitFor(() =>
      expect(api.get).toHaveBeenLastCalledWith('/platform/form-schemas', {
        params: { owner: 'platform' },
      }),
    )
    expect(screen.getByText('1 filter')).toBeTruthy()

    fireEvent.click(screen.getByText('Crown'))
    expect(navigate).toHaveBeenCalledWith({
      to: '/studio/forms/$formId',
      params: { formId: 'form-1' },
    })
  })

  it('shows the empty state with a call to action', async () => {
    api.get.mockResolvedValue(ok([]))
    renderWithClient(<FormSchemasPage />)
    expect(await screen.findByText('No form schemas yet')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /new form/i })).toHaveLength(2)
  })
})

describe('FormVersionEditor', () => {
  const renderEditor = (version: FormVersion) =>
    renderWithClient(
      <FormVersionEditor
        schema={schema()}
        version={version}
        onDiscarded={vi.fn()}
      />,
    )
  const preview = () => screen.getByRole('form', { name: 'Form preview' })

  it('previews each field and honours visibleIf', () => {
    renderEditor(formVersion())
    const p = within(preview())
    expect(p.getByRole('button', { name: 'Tooth 11' })).toBeTruthy()
    expect(p.getByRole('button', { name: 'Tooth 48' })).toBeTruthy()
    expect(p.getByText('Shade guide')).toBeTruthy()
    // Default VITA classical → "Shade" shows, the 3D-Master text does not.
    expect(p.getByText('Shade')).toBeTruthy()
    expect(p.queryByText('Shade (3D-Master)')).toBeNull()
    expect(p.getByRole('switch', { name: 'Rush case' })).toBeTruthy()
  })

  it('the preview follows the JSON editor live', () => {
    renderEditor(formVersion())
    const next = {
      fields: [
        ...shadeFields,
        { key: 'margin', type: 'text', label: 'Margin type' },
      ],
    }
    fireEvent.change(screen.getByLabelText('schemaJson'), {
      target: { value: JSON.stringify(next) },
    })
    expect(within(preview()).getByText('Margin type')).toBeTruthy()
    expect(screen.getByText('Unsaved changes')).toBeTruthy()
    // Unsaved → publish waits for a save.
    expect(screen.getByRole('button', { name: /publish/i })).toHaveProperty(
      'disabled',
      true,
    )

    fireEvent.change(screen.getByLabelText('schemaJson'), {
      target: { value: '{ "fields": [' },
    })
    expect(screen.getByText(/Invalid JSON/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /save draft/i })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('shows draft issues inline and blocks publishing while they exist', () => {
    renderEditor(
      formVersion({
        issues: [
          {
            path: 'fields[1].options',
            code: 'duplicate_option',
            message: 'Option A1 is listed twice',
          },
        ],
      }),
    )
    expect(screen.getByText('Option A1 is listed twice')).toBeTruthy()
    expect(screen.getByRole('button', { name: /publish/i })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('publishes a clean draft with its optimistic version', async () => {
    api.get.mockResolvedValue(ok(formVersion({ id: 'v1', versionNo: 1 })))
    api.post.mockResolvedValue(ok(formVersion({ status: 'published' })))
    renderEditor(formVersion())
    expect(screen.getByText('No issues — ready to publish.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /publish/i }))
    const dialog = await screen.findByRole('alertdialog')
    expect(await within(dialog).findByText(/changes? vs v1/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish' }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/platform/form-schemas/form-1/versions/v2/publish',
        { version: 3 },
      ),
    )
  })

  it('saves the parsed JSON with the version', async () => {
    api.patch.mockResolvedValue(ok(formVersion({ version: 4 })))
    renderEditor(formVersion())
    fireEvent.change(screen.getByLabelText('schemaJson'), {
      target: { value: JSON.stringify({ fields: [shadeFields[4]] }) },
    })
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(
        '/platform/form-schemas/form-1/versions/v2',
        {
          schemaJson: { fields: [shadeFields[4]] },
          uiJson: null,
          promotions: { shade: 'dental_item_details.shade' },
          version: 3,
        },
      ),
    )
  })

  it('checks tooth chart answers on the server', async () => {
    api.post.mockResolvedValue(
      ok({
        ok: false,
        issues: [
          { path: 'shade', code: 'required', message: 'Shade is required' },
        ],
        value: {},
        definitionIssues: [],
      }),
    )
    renderEditor(formVersion())
    const p = within(preview())
    fireEvent.click(p.getByRole('button', { name: 'Tooth 11' }))
    expect(
      p.getByRole('button', { name: 'Tooth 11' }).getAttribute('aria-pressed'),
    ).toBe('true')
    expect(p.getByRole('combobox', { name: 'Role of tooth 11' })).toBeTruthy()

    fireEvent.click(p.getByRole('button', { name: /check answers/i }))
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/platform/form-schemas/form-1/versions/v2/validate',
        {
          data: {
            teeth: [{ tooth: '11', role: 'crown' }],
            shade_system: 'VITA_classical',
          },
        },
      ),
    )
    // The rejected answer shows under its field and in the list.
    expect((await p.findAllByText('Shade is required')).length).toBe(2)
  })

  it('published versions are read-only', () => {
    renderEditor(formVersion({ status: 'published' }))
    expect(screen.getByLabelText('schemaJson')).toHaveProperty('readOnly', true)
    expect(screen.queryByRole('button', { name: /save draft/i })).toBeNull()
  })
})

describe('WorkflowVersionEditor', () => {
  const renderEditor = (version: WorkflowVersion) => {
    api.get.mockResolvedValue(
      ok([
        {
          code: 'recompute_order_status',
          description: 'Re-derive the order status',
          isFinancial: false,
        },
      ]),
    )
    return renderWithClient(
      <WorkflowVersionEditor
        template={template()}
        version={version}
        onDiscarded={vi.fn()}
      />,
    )
  }

  it('shows states, transitions and the test run', () => {
    renderEditor(workflowVersion())
    expect(screen.getByLabelText('State 2 code')).toHaveProperty(
      'value',
      'accepted',
    )
    expect(screen.getByLabelText('Transition 1 action')).toHaveProperty(
      'value',
      'accept',
    )
    expect(screen.getByText('States (4)')).toBeTruthy()
    expect(screen.getByText('Transitions (3)')).toBeTruthy()
    expect(screen.getByText('→ done')).toBeTruthy()
    expect(screen.getByText('Unreachable from the initial state')).toBeTruthy()
  })

  it('blocks publishing while the draft has issues and flags the row', () => {
    renderEditor(
      workflowVersion({
        issues: [
          {
            path: 'transitions[1]',
            code: 'unknown_role',
            message: 'accepted → done: no role "nurse"',
          },
        ],
      }),
    )
    expect(screen.getAllByText('accepted → done: no role "nurse"').length).toBe(
      2,
    )
    expect(screen.getByRole('button', { name: /publish/i })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('edits a state and saves the whole definition with the version', async () => {
    api.patch.mockResolvedValue(ok(workflowVersion({ version: 6 })))
    renderEditor(workflowVersion())
    fireEvent.change(screen.getByLabelText('State 2 code'), {
      target: { value: 'Approved' },
    })
    // The rename follows into the transitions.
    expect(screen.getByText('Unsaved changes')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }))
    await waitFor(() => expect(api.patch).toHaveBeenCalled())
    const [url, body] = api.patch.mock.calls[0] as [
      string,
      { definition: typeof definition; version: number },
    ]
    expect(url).toBe('/platform/workflow-templates/wf-1/versions/w2')
    expect(body.version).toBe(5)
    expect(body.definition.states[1].code).toBe('approved')
    expect(body.definition.transitions.map((t) => `${t.from}>${t.to}`)).toEqual(
      ['pending>approved', 'approved>done', 'pending>cancelled'],
    )
  })

  it('adds a state row', () => {
    renderEditor(workflowVersion())
    fireEvent.click(screen.getByRole('button', { name: /add state/i }))
    expect(screen.getByText('States (5)')).toBeTruthy()
    expect(screen.getByLabelText('State 5 code')).toBeTruthy()
  })
})

describe('FormCompare', () => {
  it('shows fields added, removed and changed between two versions', async () => {
    api.get.mockImplementation((url: string) =>
      Promise.resolve(
        ok(
          url.endsWith('/v1')
            ? formVersion({ id: 'v1', versionNo: 1, status: 'published' })
            : formVersion({
                schemaJson: {
                  fields: [
                    ...shadeFields.slice(0, 4),
                    { key: 'margin', type: 'text', label: 'Margin type' },
                  ],
                },
              }),
        ),
      ),
    )
    renderWithClient(
      <FormCompare
        schemaId="form-1"
        versions={schema().versions}
        baseId="v1"
        targetId="v2"
        onBase={vi.fn()}
        onTarget={vi.fn()}
      />,
    )
    expect(await screen.findByText('2 changes from v1 to v2.')).toBeTruthy()
    expect(screen.getByText('Margin type')).toBeTruthy()
    expect(screen.getByText('Rush case')).toBeTruthy()
    expect(screen.getAllByText('Added')).toHaveLength(1)
    expect(screen.getAllByText('Removed')).toHaveLength(1)
  })
})

describe('StageTemplatesPage', () => {
  const stage: StageTemplate = {
    id: 'st-1',
    specialty: { id: 'sp-1', code: 'DENTAL' },
    organization: null,
    code: 'PFM_3_STAGE',
    name: 'PFM three stage',
    isActive: true,
    version: 2,
    steps: [
      {
        seq: 1,
        code: 'metal_tryin',
        name: 'Metal try-in',
        requiresPatientVisit: true,
        requiresDoctorApproval: true,
        defaultLabDays: 3,
      },
      {
        seq: 2,
        code: 'bisque_tryin',
        name: 'Bisque try-in',
        requiresPatientVisit: true,
        requiresDoctorApproval: true,
        defaultLabDays: 3,
      },
      {
        seq: 3,
        code: 'final',
        name: 'Final',
        requiresPatientVisit: false,
        requiresDoctorApproval: false,
        defaultLabDays: 4,
      },
    ],
  }

  it('reorders steps and saves them with the version', async () => {
    api.get.mockImplementation((url: string) =>
      Promise.resolve(ok(url === '/platform/stage-templates' ? [stage] : [])),
    )
    api.patch.mockResolvedValue(ok({ ...stage, version: 3 }))
    renderWithClient(<StageTemplatesPage />)

    expect(await screen.findByText('PFM three stage')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Edit PFM_3_STAGE' }))

    const sheet = await screen.findByRole('dialog')
    fireEvent.click(
      within(sheet).getByRole('button', { name: 'Move step 1 down' }),
    )
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/platform/stage-templates/st-1', {
        name: 'PFM three stage',
        isActive: true,
        steps: [
          expect.objectContaining({ code: 'bisque_tryin' }),
          expect.objectContaining({ code: 'metal_tryin', defaultLabDays: 3 }),
          expect.objectContaining({ code: 'final', defaultLabDays: 4 }),
        ],
        version: 2,
      }),
    )
  })

  it('needs a code and name on each step', async () => {
    api.get.mockResolvedValue(ok([]))
    renderWithClient(<StageTemplatesPage />)
    fireEvent.click(
      (
        await screen.findAllByRole('button', { name: /new stage template/i })
      )[0],
    )
    const sheet = await screen.findByRole('dialog')
    fireEvent.click(
      within(sheet).getByRole('button', { name: 'Create template' }),
    )
    expect(
      (await within(sheet).findAllByText('Code is required')).length,
    ).toBeGreaterThan(0)
    expect(api.post).not.toHaveBeenCalled()
  })
})
