
import React from 'react';
import { F1CarIcon } from './icons/F1CarIcon.tsx';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`animate-pulse bg-pure-white/5 rounded ${className}`} />
);

export const AppSkeleton: React.FC = () => (
  <div className="min-h-screen bg-carbon-black flex flex-col md:flex-row text-ghost-white relative overflow-hidden">
    {/* Atmospheric Background */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-red/5 via-carbon-black to-carbon-black opacity-50"></div>
    <div className="absolute inset-0 bg-carbon-fiber opacity-10"></div>

    {/* Center Loading Indicator */}
    <div className="absolute inset-0 flex flex-col items-center justify-center z-50">
        <div className="relative mb-8">
            <div className="absolute inset-0 bg-primary-red/20 blur-xl rounded-full animate-pulse"></div>
            <F1CarIcon className="w-24 h-24 text-primary-red animate-bounce icon-glow relative z-10" />
        </div>
        <div className="flex flex-col items-center gap-2">
            <h2 className="text-2xl font-black italic uppercase tracking-tighter text-pure-white text-glow-red animate-pulse">
                LIGHTS OUT LEAGUE
            </h2>
            <p className="text-xs font-mono text-highlight-silver uppercase tracking-[0.4em] opacity-60">
                ESTABLISHING UPLINK...
            </p>
        </div>
    </div>

    {/* Subtle UI Skeleton in Background */}
    <div className="hidden md:flex flex-col w-72 p-4 border-r border-pure-white/5 gap-6 h-screen opacity-20 pointer-events-none">
       <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-12 h-12 rounded-full" />
          <Skeleton className="h-6 w-32" />
       </div>
       {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
    </div>
    
    <div className="flex-1 flex flex-col h-screen overflow-hidden opacity-20 pointer-events-none">
        <div className="md:hidden p-4 border-b border-pure-white/5 flex justify-between items-center">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-16" />
        </div>

        <div className="flex-1 p-4 md:p-8 space-y-8 overflow-y-auto">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-48 w-full rounded-2xl" />
                <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
        </div>
    </div>
  </div>
);

export const ListSkeleton: React.FC<{ rows?: number; height?: string }> = ({ rows = 5, height = "h-16" }) => (
  <div className="space-y-3 w-full animate-fade-in">
    {[...Array(rows)].map((_, i) => (
      <Skeleton key={i} className={`${height} w-full rounded-lg`} />
    ))}
  </div>
);

export const CardGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
    {[...Array(count)].map((_, i) => (
      <Skeleton key={i} className="h-32 w-full rounded-xl" />
    ))}
  </div>
);

export const ProfileSkeleton: React.FC = () => (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto w-full">
        <div className="flex flex-col items-center gap-4 py-8">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-6 w-32 rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
             {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Skeleton className="h-96 w-full rounded-lg" />
            <div className="space-y-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
            </div>
        </div>
    </div>
);
