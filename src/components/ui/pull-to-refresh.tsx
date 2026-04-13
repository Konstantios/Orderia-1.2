'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PullToRefresh({ children, rootRef }: { children: React.ReactNode; rootRef?: React.RefObject<HTMLDivElement | null> }) {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const pullThreshold = 150; // Distance in px to trigger refresh
    const startY = useRef(0);
    const isPulling = useRef(false);

    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            // Check if we are at the top of the scrollable container
            const scrollTop = rootRef?.current ? rootRef.current.scrollTop : window.scrollY;
            
            if (scrollTop <= 0) {
                startY.current = e.touches[0].pageY;
                isPulling.current = true;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isPulling.current || isRefreshing) return;

            const currentY = e.touches[0].pageY;
            const distance = currentY - startY.current;

            if (distance > 0) {
                // Resistance effect
                const pull = Math.min(distance * 0.4, pullThreshold + 20);
                setPullDistance(pull);
                
                // Prevent browser default pull-to-refresh if we are handling it
                if (distance > 10 && e.cancelable) {
                    // Only prevent if we are actually at the top and pulling down
                    e.preventDefault();
                }
            } else {
                 isPulling.current = false;
                 setPullDistance(0);
            }
        };

        const handleTouchEnd = () => {
            if (!isPulling.current) return;
            
            if (pullDistance >= pullThreshold) {
                triggerRefresh();
            } else {
                setPullDistance(0);
            }
            isPulling.current = false;
        };

        const triggerRefresh = () => {
            setIsRefreshing(true);
            setPullDistance(pullThreshold);
            
            // Artificial delay for visual feedback before hard reload
            setTimeout(() => {
                window.location.reload();
            }, 800);
        };

        // If we have a rootRef, we should listen on that element or window?
        // Listening on window is safer for gestures starting outside but affecting the container
        window.addEventListener('touchstart', handleTouchStart, { passive: false });
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd);

        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [pullDistance, isRefreshing, rootRef]);

    return (
        <div className="relative w-full">
            {/* Refresh Indicator */}
            <div 
                className={cn(
                    "fixed top-0 left-0 right-0 flex justify-center z-[100] pointer-events-none transition-transform duration-200",
                    pullDistance > 0 || isRefreshing ? "opacity-100" : "opacity-0"
                )}
                style={{ transform: `translateY(${pullDistance - 60}px)` }}
            >
                <div className={cn(
                    "bg-primary text-primary-foreground p-3 rounded-full shadow-lg border border-primary/20 flex items-center gap-2",
                    isRefreshing && "animate-bounce"
                )}>
                    <RefreshCw className={cn("h-5 w-5", (isRefreshing || pullDistance > 0) && "animate-spin")} />
                    {pullDistance >= pullThreshold && !isRefreshing && <span className="text-xs font-bold uppercase tracking-wider">Αφήστε για ανανέωση</span>}
                    {isRefreshing && <span className="text-xs font-bold uppercase tracking-wider">Ανανέωση...</span>}
                </div>
            </div>

            {/* Content Container */}
            <div 
                className="w-full"
                style={{ 
                    transform: `translateY(${pullDistance * 0.2}px)`,
                    transition: isPulling.current ? 'none' : 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)'
                }}
            >
                {children}
            </div>
        </div>
    );
}
