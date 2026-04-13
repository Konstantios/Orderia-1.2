'use client';

import { useState, useRef } from 'react';
import { useFirebase } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value?: string;
  onUpload: (url: string) => void;
  path: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

export function ImageUpload({ value, onUpload, path, className, fallbackIcon }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { storage, user } = useFirebase();
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Basic validation
    if (!file.type.startsWith('image/')) {
        toast({
            variant: 'destructive',
            title: 'Λάθος αρχείο',
            description: 'Παρακαλώ επιλέξτε μια εικόνα.',
        });
        return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
            variant: 'destructive',
            title: 'Πολύ μεγάλο αρχείο',
            description: 'Η εικόνα πρέπει να είναι μικρότερη από 2MB.',
        });
        return;
    }

    setIsUploading(true);
    setProgress(0);

    try {
      const fileName = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `${path}/${user.uid}/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(p);
        },
        (error) => {
          console.error('Upload error:', error);
          setIsUploading(false);
          toast({
            variant: 'destructive',
            title: 'Σφάλμα μεταφόρτωσης',
            description: 'Δεν ήταν δυνατή η αποθήκευση της εικόνας.',
          });
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          onUpload(downloadURL);
          setIsUploading(false);
          toast({
            title: 'Επιτυχία',
            description: 'Η εικόνα αποθηκεύτηκε με επιτυχία.',
          });
        }
      );
    } catch (error) {
      console.error('Upload catch error:', error);
      setIsUploading(false);
    }
  };

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="relative group">
        <Avatar className="h-24 w-24 border-2 border-muted overflow-hidden">
          <AvatarImage src={value} className="object-cover" />
          <AvatarFallback className="bg-primary/5">
            {fallbackIcon || <User className="h-10 w-10 text-muted-foreground" />}
          </AvatarFallback>
        </Avatar>
        
        {isUploading && (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-full z-10">
              <Loader2 className="h-6 w-6 text-white animate-spin mb-1" />
              <span className="text-[10px] text-white font-bold">{Math.round(progress)}%</span>
           </div>
        )}

        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full shadow-lg border-2 border-background hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
        >
          <Camera className="h-4 w-4" />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
