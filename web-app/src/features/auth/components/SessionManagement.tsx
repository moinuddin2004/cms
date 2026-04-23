import { useEffect, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import apiClient from '@/lib/api'
import {
  Monitor,
  Smartphone,
  Globe,
  LogOut,
  Loader2,
  Shield,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/useAuthStore'

interface Session {
  id: string
  device: string | null
  browser: string | null
  os: string | null
  ipAddress: string | null
  location: string | null
  isCurrent: boolean
  createdAt: string
  lastActiveAt: string
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`
  return date.toLocaleDateString()
}

export function SessionManagement() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const { clearAuth } = useAuthStore()

  const fetchSessions = async () => {
    try {
      const res = await apiClient.get('/auth/sessions')
      setSessions(res.data.data)
    } catch (err) {
      toast.error('Failed to load sessions')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  const revokeSession = async (id: string, isCurrent: boolean) => {
    setActionLoadingId(id)
    try {
      if (isCurrent) {
        await apiClient.post('/auth/logout')
        clearAuth()
        toast.success('Signed out successfully')
        window.location.href = '/login'
      } else {
        await apiClient.delete(`/auth/sessions/${id}`)
        setSessions((prev) => prev.filter((s) => s.id !== id))
        toast.success('Session revoked')
      }
    } catch (err) {
      toast.error('Failed to revoke session')
    } finally {
      setActionLoadingId(null)
    }
  }

  const revokeAllOtherSessions = async () => {
    setActionLoadingId('all-others')
    try {
      await apiClient.post('/auth/sessions/revoke-all')
      toast.success('All other sessions revoked')
      fetchSessions()
    } catch (err) {
      toast.error('Failed to revoke sessions')
    } finally {
      setActionLoadingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    )
  }

  return (
    <Card className="shadow-sm border-border/50 rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">
              Active Sessions
            </CardTitle>
            <CardDescription className="text-sm">
              Manage your active sessions across browsers and devices
            </CardDescription>
          </div>
        </div>
        {sessions.length > 1 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={revokeAllOtherSessions}
            disabled={actionLoadingId === 'all-others'}
          >
            {actionLoadingId === 'all-others' ? (
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
            ) : null}
            Sign out all others
          </Button>
        )}
      </CardHeader>
      <Separator />
      <CardContent className="pt-6">
        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-full transition-colors ${
                    session.isCurrent
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground group-hover:text-foreground'
                  }`}
                >
                  {session.device?.toLowerCase().includes('mobile') ||
                  session.device?.toLowerCase().includes('iphone') ||
                  session.device?.toLowerCase().includes('android') ? (
                    <Smartphone className="h-5 w-5" />
                  ) : (
                    <Monitor className="h-5 w-5" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">
                      {session.os || 'Unknown OS'}
                      <span className="mx-1.5 text-muted-foreground">•</span>
                      {session.browser || 'Unknown Browser'}
                    </p>
                    {session.isCurrent && (
                      <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 text-xs font-medium">
                        Current
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {session.ipAddress || 'Unknown IP'}
                    </span>
                    <span>Last active: {timeAgo(session.lastActiveAt)}</span>
                  </div>
                </div>
              </div>
              <Button
                variant={session.isCurrent ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => revokeSession(session.id, session.isCurrent)}
                disabled={actionLoadingId === session.id}
                className="shrink-0"
              >
                {actionLoadingId === session.id ? (
                  <Loader2 className="animate-spin h-4 w-4" />
                ) : (
                  <>
                    <LogOut className="mr-1.5 h-3.5 w-3.5" />
                    {session.isCurrent ? 'Sign out' : 'Revoke'}
                  </>
                )}
              </Button>
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No active sessions found.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
