import type { ReactNode } from 'react'
import type { LegalBlock } from '../content/types'

/** **bold** becomes <strong>; everything else is plain text. */
function inline(text: string): Array<ReactNode> {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') ? (
      <strong
        key={i}
        className="font-semibold text-slate-900 dark:text-slate-100"
      >
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  )
}

const heading = 'text-slate-900 dark:text-slate-100'

/** Renders the parsed legal Markdown blocks (see mobile-app/docs/legal). */
export function LegalDocument({ blocks }: { blocks: Array<LegalBlock> }) {
  return (
    <article className="space-y-4 text-sm leading-6 text-slate-700 dark:text-slate-300">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h1':
            return (
              <h1
                key={i}
                className={`text-2xl font-semibold tracking-tight ${heading}`}
              >
                {b.text}
              </h1>
            )
          case 'h2':
            return (
              <h2 key={i} className={`pt-4 text-lg font-medium ${heading}`}>
                {b.text}
              </h2>
            )
          case 'h3':
            return (
              <h3 key={i} className={`pt-2 text-base font-medium ${heading}`}>
                {b.text}
              </h3>
            )
          case 'note':
            return (
              <p
                key={i}
                role="note"
                className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
              >
                {inline(b.text)}
              </p>
            )
          case 'ul':
            return (
              <ul key={i} className="list-disc space-y-1 ps-5">
                {b.items.map((t, j) => (
                  <li key={j}>{inline(t)}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} className="list-decimal space-y-1 ps-5">
                {b.items.map((t, j) => (
                  <li key={j}>{inline(t)}</li>
                ))}
              </ol>
            )
          default:
            return <p key={i}>{inline(b.text)}</p>
        }
      })}
    </article>
  )
}
