export default function GlassCard({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`p-8 sm:p-12 md:p-16 gap-8 md:gap-12 glass-card flex flex-col ${className}`}>
      {children}
    </div>
  );
}

export function GlassCardTitle({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <h1 className={`text-4xl md:text-5xl font-display tracking-[0.02em]  ${className}`}>
      {children}
    </h1>
  );
}

export function GlassCardContent({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={`flex flex-col gap-4 md:gap-6 text-lg sm:text-xl md:text-2xl text-rock/90 ${className}`}
    >
      {children}
    </div>
  );
}
