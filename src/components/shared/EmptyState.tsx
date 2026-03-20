interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 bg-zinc-950/50 px-6 py-16 text-center">
      {icon && <div className="mb-4 text-zinc-600">{icon}</div>}
      <h3 className="text-base font-semibold text-zinc-300">{title}</h3>
      {description && (
        <p className="mt-1.5 text-sm text-zinc-500 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
