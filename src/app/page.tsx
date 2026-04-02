'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Logo } from '@/components/logo';

export default function LoginPage() {
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock login logic
    router.push('/dashboard');
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock admin login logic
    router.push('/admin/dashboard');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center justify-center space-y-4">
        <Logo />
        <h1 className="font-headline text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
          Welcome to Orderia
        </h1>
        <p className="text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
          Your intelligent ordering assistant
        </p>
      </div>
      <Card className="mt-8 w-full max-w-sm border-2 border-primary/20 bg-card/80 shadow-lg shadow-primary/10">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-2xl">Customer Login</CardTitle>
          <CardDescription>Enter your credentials to access your dashboard.</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email / Phone</Label>
              <Input id="email" type="email" placeholder="m@example.com" defaultValue="demo@bakery.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">PIN / Password</Label>
              <Input id="password" type="password" defaultValue="demopass" required />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="remember-me" />
              <Label htmlFor="remember-me">Remember me</Label>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold text-lg h-12">
              Login
            </Button>
            <Button variant="outline" onClick={handleAdminLogin} className="w-full">
              Wholesaler Access
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
