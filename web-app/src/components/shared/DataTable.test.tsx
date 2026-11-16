import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DataTable } from './DataTable'
import type { ColumnDef } from './table-features'

interface Row {
  name: string
  age: number
}

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'age', header: 'Age' },
]

const rows: Row[] = [
  { name: 'Alpha', age: 30 },
  { name: 'Bravo', age: 10 },
  { name: 'Charlie', age: 20 },
]

// The pagination summary is split across spans ("Showing" hides on mobile),
// so match the innermost element whose whole text reads e.g. "Showing 1–2 of 3".
function getSummary(text: RegExp) {
  return screen.getByText((_, el) => {
    if (!el || !text.test(el.textContent)) return false
    return Array.from(el.children).every((c) => !text.test(c.textContent))
  })
}

function renderedNames() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelectorAll('td')[0].textContent)
}

describe('DataTable v9 smoke', () => {
  it('paginates client-side rows', () => {
    render(<DataTable columns={columns} data={rows} defaultPageSize={2} />)

    expect(renderedNames()).toEqual(['Alpha', 'Bravo'])
    expect(getSummary(/^Showing 1–2 of 3$/)).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Next page'))

    expect(renderedNames()).toEqual(['Charlie'])
    expect(getSummary(/^Showing 3–3 of 3$/)).toBeTruthy()
  })

  it('renders every row when pagination is off', () => {
    render(<DataTable columns={columns} data={rows} pagination={false} />)

    expect(renderedNames()).toEqual(['Alpha', 'Bravo', 'Charlie'])
    expect(screen.queryByLabelText('Next page')).toBeNull()
  })

  it('sorts before paginating', () => {
    render(<DataTable columns={columns} data={rows} defaultPageSize={2} />)

    fireEvent.click(screen.getByText('Name'))
    expect(renderedNames()).toEqual(['Alpha', 'Bravo'])

    fireEvent.click(screen.getByText('Name'))
    expect(renderedNames()).toEqual(['Charlie', 'Bravo'])
  })
})
