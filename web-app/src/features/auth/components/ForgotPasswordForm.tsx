import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useNavigate } from '@tanstack/react-router';
import axios from 'axios';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await axios.post('http://localhost:5000/auth/forgot-password', { email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to process request. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
        <Card className="w-full max-w-md mx-auto shadow-lg border-muted/20">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold text-primary">Check your email</CardTitle>
                <CardDescription>
                  If an account exists with this email, we have sent a password reset link.
                </CardDescription>
            </CardHeader>
            <CardFooter>
                <Button onClick={() => navigate({ to: '/login' })} className="w-full">
                    Return to Login
                </Button>
            </CardFooter>
        </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg border-muted/20 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-3xl font-bold tracking-tight">Forgot Password</CardTitle>
        <CardDescription className="text-muted-foreground">
          Enter your email and we'll send you a link to reset your password
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleForgot}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && <div className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-md">{error}</div>}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full transition-all active:scale-[0.98]" disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Send reset instructions'}
          </Button>
          <div className="text-sm text-center text-muted-foreground">
            Remember your password?{' '}
            <Button variant="link" className="p-0 h-auto font-semibold cursor-pointer" onClick={(e) => { e.preventDefault(); navigate({ to: '/login' }); }}>
              Back to login
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
