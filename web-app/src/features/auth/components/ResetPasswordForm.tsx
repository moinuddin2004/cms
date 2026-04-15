import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useNavigate, useSearch } from '@tanstack/react-router';
import axios from 'axios';

export function ResetPasswordForm() {
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  // @ts-ignore: Assume standard tanstack useRouter search structure for simplicity
  const search = useSearch({ strict: false });
  const token = (search as any)?.token || '';

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await axios.patch('http://localhost:5000/auth/reset-password', {
        token,
        newPassword,
      });
      setSuccess(true);
    } catch (err: any) {
      if (Array.isArray(err.response?.data?.message)) {
          setError(err.response?.data?.message[0]);
      } else {
          setError(err.response?.data?.message || 'Failed to reset password. Link may be expired.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
      return (
          <div className="p-4 text-center text-destructive">Invalid or missing reset token.</div>
      )
  }

  if (success) {
    return (
        <Card className="w-full max-w-md mx-auto shadow-lg border-muted/20">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold text-primary">Password Reset Successful</CardTitle>
                <CardDescription>
                  Your password has been successfully reset. You can now use your new password to log in.
                </CardDescription>
            </CardHeader>
            <CardFooter>
                <Button onClick={() => navigate({ to: '/login' })} className="w-full">
                    Go to Login
                </Button>
            </CardFooter>
        </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg border-muted/20 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-3xl font-bold tracking-tight">Set new password</CardTitle>
        <CardDescription className="text-muted-foreground">
          Enter your new password below
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleReset}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Minimum 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-md">{error}</div>}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full transition-all active:scale-[0.98]" disabled={isLoading}>
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
