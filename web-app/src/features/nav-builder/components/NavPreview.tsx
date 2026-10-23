import { isNavGroup, resolveNav, useNavViewer } from '@/features/access'
import type { NavLayout, NavLink } from '@/features/access'

function PreviewLink({
  link,
  nested = false,
}: {
  link: NavLink
  nested?: boolean
}) {
  return (
    <li
      className={
        nested
          ? 'flex items-center gap-2.5 rounded-md px-2 py-1 text-[13px] text-text-2'
          : 'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-text-2'
      }
    >
      <link.icon className="size-4 shrink-0" />
      <span className="truncate">{link.label}</span>
    </li>
  )
}

/**
 * The draft as the sidebar would draw it for the signed-in user — through
 * the same resolver, so hidden, unknown and not-permitted pages drop out
 * exactly as they will after saving.
 */
export function NavPreview({ layout }: { layout: NavLayout }) {
  const viewer = useNavViewer()
  const sections = resolveNav(layout, viewer)

  return (
    <div className="rounded-xl border border-sidebar-border bg-sidebar p-3 shadow-sm">
      {sections.length === 0 ? (
        <p className="px-2 py-6 text-center text-sm text-muted-foreground">
          Nothing to show — every page is hidden.
        </p>
      ) : (
        sections.map((section, i) => (
          <div
            key={`${section.label ?? ''}-${i}`}
            className={i > 0 ? 'mt-3' : ''}
          >
            {section.label && (
              <div className="px-2.5 pb-1 text-[10.5px] font-bold uppercase tracking-[0.09em] text-text-3">
                {section.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((entry, j) =>
                isNavGroup(entry) ? (
                  <li key={`${entry.label}-${j}`}>
                    <div className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm font-medium text-text-2">
                      <entry.icon className="size-4 shrink-0" />
                      <span className="truncate">{entry.label}</span>
                    </div>
                    <ul className="ml-[17px] space-y-0.5 border-l border-sidebar-border pl-2.5">
                      {entry.children.map((c) => (
                        <PreviewLink key={c.key} link={c} nested />
                      ))}
                    </ul>
                  </li>
                ) : (
                  <PreviewLink key={entry.key} link={entry} />
                ),
              )}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
