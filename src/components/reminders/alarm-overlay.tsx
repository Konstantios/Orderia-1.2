'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AlarmOverlayProps {
  isOpen: boolean;
  onStop: () => void;
  onSnooze: () => void;
  onOrder: () => void;
  title?: string;
  message?: string;
}

const ALARM_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export function AlarmOverlay({ 
    isOpen, 
    onStop, 
    onSnooze,
    onOrder,
    title = 'ΥΠΕΝΘΥΜΙΣΗ ΠΑΡΑΓΓΕΛΙΑΣ', 
    message = 'Ήρθε η ώρα να βάλετε την παραγγελία σας!' 
}: AlarmOverlayProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (!audioRef.current) {
        audioRef.current = new Audio(ALARM_SOUND_URL);
        audioRef.current.loop = true;
      }
      
      const playAudio = async () => {
        try {
          await audioRef.current?.play();
        } catch (error) {
          console.warn('Autoplay blocked. Audio will play after user interaction.', error);
        }
      };
      
      playAudio();
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md p-6"
        >
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-destructive/50 bg-card shadow-2xl shadow-destructive/20 p-8 text-center space-y-8">
            {/* Pulsing Background Effect */}
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.1)_0%,transparent_70%)] animate-pulse" />
            
            <div className="flex justify-center">
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  rotate: [0, -10, 10, -10, 10, 0]
                }}
                transition={{ 
                  repeat: Infinity, 
                  duration: 1.5,
                  ease: "easeInOut"
                }}
                className="bg-destructive/20 p-6 rounded-full"
              >
                <Bell className="h-16 w-16 text-destructive animate-bounce" />
              </motion.div>
            </div>

            <div className="space-y-4">
              <h2 className="text-4xl font-black font-headline tracking-tighter text-destructive uppercase">
                {title}
              </h2>
              <p className="text-xl text-muted-foreground font-medium">
                {message}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <Button
                variant="destructive"
                size="lg"
                className="h-16 text-xl font-black rounded-2xl shadow-lg shadow-destructive/30 uppercase tracking-widest hover:scale-105 transition-transform active:scale-95"
                onClick={onStop}
              >
                <BellOff className="mr-3 h-6 w-6" />
                ΔΙΑΚΟΠΗ
              </Button>

              <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-16 text-lg font-bold rounded-2xl border-primary/20 hover:bg-primary/5 transition-all"
                    onClick={onSnooze}
                  >
                    ΑΝΑΒΟΛΗ (10')
                  </Button>
                  
                  <Button
                    variant="default"
                    size="lg"
                    className="h-16 text-lg font-bold rounded-2xl bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20 transition-all"
                    onClick={onOrder}
                  >
                    ΠΑΡΑΓΓΕΛΙΑ
                  </Button>
              </div>
              
              <p className="text-xs text-muted-foreground animate-pulse pt-2">
                Το ξυπνητήρι θα συνεχίσει να χτυπάει μέχρι να επιλέξετε μια ενέργεια
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
