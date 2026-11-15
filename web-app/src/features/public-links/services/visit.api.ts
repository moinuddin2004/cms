import { publicApi } from '@/lib/publicApi'

export interface VisitState {
  clinicName: string
  locationName: string
  token: string
  status: string
  peopleAhead: number | null
  nowServingToken: string | null
  updatedAt: string
}

/** `GET /visit/:token/state` — public, no names (07 §6.3; endpoint arrives with M3-05). */
export async function fetchVisitState(token: string): Promise<VisitState> {
  const { data } = await publicApi.get(
    `/visit/${encodeURIComponent(token)}/state`,
  )
  return data.data
}
