import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';
import { Monitor, Smartphone, Globe, LogOut, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Session {
  id: string;
  device: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  location: string | null;
  isCurrent: boolean;
  createdAt: string;
  lastActiveAt: string;
}

export function SessionManagement() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const { accessToken, clearAuth } = useAuthStore();

  const fetchSessions = async () => {
    try {
      const res = await axios.get('http://localhost:5000/auth/sessions', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setSessions(res.data.data);
    } catch (err) {
      console.error('Failed to fetch sessions', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [accessToken]);

  const revokeSession = async (id: string, isCurrent: boolean) => {
    setActionLoadingId(id);
    try {
      if (isCurrent) {
        await axios.post('http://localhost:5000/auth/logout', {}, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        clearAuth();
        window.location.href = '/login';
      } else {
        await axios.delete(`http://localhost:5000/auth/sessions/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setSessions(prev => prev.filter(s => s.id !== id));
      }
    } catch (err) {
      console.error('Failed to revoke session', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const revokeAllOtherSessions = async () => {
    setActionLoadingId('all-others');
    try {
      await axios.post('http://localhost:5000/auth/sessions/revoke-all', {}, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      fetchSessions();
    } catch (err) {
      console.error('Failed to revoke other sessions', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  }

  return (
    <Card className="w-full shadow-md border-muted/30">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-2xl font-bold">Active Sessions</CardTitle>
          <CardDescription>
            Manage and log out your active sessions on other browsers and devices.
          </CardDescription>
        </div>
        {sessions.length > 1 && (
             <Button variant="destructive" size="sm" onClick={revokeAllOtherSessions} disabled={actionLoadingId === 'all-others'}>
                 {actionLoadingId === 'all-others' ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                 Sign out of all other devices
             </Button>
        )}
      </CardHeader>
      <Separator />
      <CardContent className="pt-6">
        <div className="space-y-6">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="bg-muted p-3 rounded-full text-muted-foreground group-hover:text-primary transition-colors">
                  {session.device === 'Mobile' ? <Smartphone className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">
                      {session.os || 'Unknown OS'} <span className="mx-1 text-muted-foreground">•</span> {session.browser || 'Unknown Browser'}
                    </p>
                    {session.isCurrent && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">Current Device</Badge>
                    )}
                  </div>
                  <div className="flex flex-col text-sm text-muted-foreground mt-1">
                    <div className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      <span>{session.ipAddress}</span>
                      {session.location && <span>• {session.location}</span>}
                    </div>
                    <span>Last active: {new Date(session.lastActiveAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => revokeSession(session.id, session.isCurrent)}
                disabled={actionLoadingId === session.id}
              >
                  {actionLoadingId === session.id ? (
                      <Loader2 className="animate-spin h-4 w-4" />
                  ) : (
                      <>
                        <LogOut className="mr-2 h-4 w-4" />
                        {session.isCurrent ? 'Sign out' : 'Revoke'}
                      </>
                  )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
