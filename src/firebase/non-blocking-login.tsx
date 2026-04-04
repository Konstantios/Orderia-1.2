'use client';
import {
  Auth, // Import Auth type for type hinting
  User,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { toast } from '@/hooks/use-toast';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  signInAnonymously(authInstance).catch((error) => {
    toast({
      variant: 'destructive',
      title: 'Σφάλμα Ανώνυμης Σύνδεσης',
      description: error.message || 'Δεν ήταν δυνατή η ανώνυμη σύνδεση.',
    });
  });
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(
  authInstance: Auth,
  email: string,
  password: string,
  onSuccess: (user: User) => Promise<void> | void
): void {
  createUserWithEmailAndPassword(authInstance, email, password)
    .then(async (userCredential) => {
      await onSuccess(userCredential.user);
    })
    .catch((error) => {
      let title = 'Σφάλμα Εγγραφής';
      let description = 'Προέκυψε ένα άγνωστο σφάλμα. Παρακαλώ δοκιμάστε ξανά.';

      switch (error.code) {
        case 'auth/weak-password':
          description =
            'Ο κωδικός πρόσβασης πρέπει να έχει τουλάχιστον 6 χαρακτήρες.';
          break;
        case 'auth/email-already-in-use':
          description = 'Αυτή η διεύθυνση email χρησιμοποιείται ήδη.';
          break;
        case 'auth/invalid-email':
          description = 'Η διεύθυνση email δεν είναι έγκυρη.';
          break;
        default:
          description = error.message;
          break;
      }

      toast({
        variant: 'destructive',
        title: title,
        description: description,
      });
    });
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(
  authInstance: Auth,
  email: string,
  password: string,
  onSuccess: (user: User) => void,
  onFinally?: () => void
): void {
  signInWithEmailAndPassword(authInstance, email, password)
    .then((userCredential) => {
      onSuccess(userCredential.user);
    })
    .catch((error) => {
      let title = 'Σφάλμα Σύνδεσης';
      let description = 'Προέκυψε ένα άγνωστο σφάλμα. Παρακαλώ δοκιμάστε ξανά.';

      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          description = 'Λάθος συνδυασμός email και κωδικού.';
          break;
        case 'auth/invalid-email':
          description = 'Η διεύθυνση email δεν είναι έγκυρη.';
          break;
        default:
          description = error.message;
          break;
      }

      toast({
        variant: 'destructive',
        title: title,
        description: description,
      });
    })
    .finally(() => {
        onFinally?.();
    });
}
