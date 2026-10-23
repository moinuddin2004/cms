import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { BackButton } from '@/components/shared/BackButton'
import { useNavHistoryStore } from '@/store/nav-history-store'
import { usePageTitle, useTrackNavHistory } from './useBackNavigation'

function Page({ title }: { title?: string }) {
  usePageTitle(title)
  return <h1>{title ?? 'untitled'}</h1>
}

function buildRouter(initial: string) {
  const root = createRootRoute({
    component: () => {
      useTrackNavHistory()
      return <Outlet />
    },
  })
  const page = (path: string, title?: string, back?: boolean) =>
    createRoute({
      getParentRoute: () => root,
      path,
      component: () => (
        <>
          {back && <BackButton to="/patients" label="Back to patients" />}
          <Page title={title} />
        </>
      ),
    })
  const routeTree = root.addChildren([
    page('/login'),
    page('/dashboard'),
    page('/queue', 'Reception queue'),
    page('/patients', 'Patients'),
    page('/patients/new', 'New patient'),
    page('/patients/$patientId', 'Ali Khan', true),
  ])
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initial] }),
  })
}

type TestRouter = ReturnType<typeof buildRouter>

async function setup(initial: string) {
  const router = buildRouter(initial)
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading')
  return router
}

async function go(router: TestRouter, to: string, replace = false) {
  await act(() => router.navigate({ to, replace }))
}

function pathname(router: TestRouter) {
  return router.state.location.pathname
}

async function clickBack(name: string) {
  fireEvent.click(await screen.findByRole('link', { name }))
}

describe('BackButton / useBackNavigation', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useNavHistoryStore.setState({ entries: {} })
  })

  it('returns to the page the user came from, named after it', async () => {
    const router = await setup('/dashboard')
    await go(router, '/patients/p1')

    await clickBack('Back to Dashboard')
    await waitFor(() => expect(pathname(router)).toBe('/dashboard'))
  })

  it('uses the title the previous page registered', async () => {
    const router = await setup('/queue')
    await go(router, '/patients/p1')

    await clickBack('Back to Reception queue')
    await waitFor(() => expect(pathname(router)).toBe('/queue'))
  })

  it('falls back to the parent route when opened directly', async () => {
    const router = await setup('/patients/p1')

    await clickBack('Back to patients')
    await waitFor(() => expect(pathname(router)).toBe('/patients'))
  })

  it('skips same-page entries such as tab or filter changes', async () => {
    const router = await setup('/dashboard')
    await go(router, '/patients/p1')
    act(() => router.history.push('/patients/p1?tab=billing'))
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ tab: 'billing' }),
    )

    await clickBack('Back to Dashboard')
    await waitFor(() => expect(pathname(router)).toBe('/dashboard'))
  })

  it('goes past a saved create form', async () => {
    const router = await setup('/patients')
    await go(router, '/patients/new')
    await go(router, '/patients/p1')

    await clickBack('Back to Patients')
    await waitFor(() => expect(pathname(router)).toBe('/patients'))
  })

  it('never returns to an auth screen', async () => {
    const router = await setup('/login')
    await go(router, '/patients/p1')

    await clickBack('Back to patients')
    await waitFor(() => expect(pathname(router)).toBe('/patients'))
  })
})
