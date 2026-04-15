export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border-b border-border bg-background px-8 py-6 flex items-start justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function PagePlaceholder({
  phase,
  description,
}: {
  phase: string;
  description: string;
}) {
  return (
    <div className="px-8 py-10">
      <div className="max-w-2xl rounded-xl border border-dashed border-border bg-background p-8 text-center">
        <div className="inline-flex items-center justify-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          {phase}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
