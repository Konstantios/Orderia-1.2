import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function SuppliersPage() {
  return (
    <div>
      <h1 className="font-headline text-3xl font-bold">Προμηθευτές</h1>
      <p className="text-muted-foreground">Διαχειριστείτε τους προμηθευτές σας.</p>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Λίστα Προμηθευτών</CardTitle>
          <CardDescription>
            Αυτή η λειτουργία είναι υπό κατασκευή.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
