'use client';
import { CheckCircle2, Info, TriangleAlert, CircleAlert } from 'lucide-react';
import { Toaster } from 'sonner';
export function FeedbackToaster({ theme }: { theme: 'light' | 'dark' }) {
    return <Toaster theme={theme} position="top-center" closeButton visibleToasts={2} gap={8} offset="max(12px, env(safe-area-inset-top))" mobileOffset="max(12px, env(safe-area-inset-top))" icons={{ success:<CheckCircle2 size={18}/>, info:<Info size={18}/>, warning:<TriangleAlert size={18}/>, error:<CircleAlert size={18}/> }} toastOptions={{ duration:3800, className:'feedback-toast' }}/>;
}
