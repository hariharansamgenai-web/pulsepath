interface LoadingProps {
  fullPage?: boolean;
  label?: string;
}

export function Loading({ fullPage, label }: LoadingProps) {
  const content = (
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-primary-600" />
      {label && <p className="text-sm text-neutral-500">{label}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        {content}
      </div>
    );
  }

  return <div className="flex items-center justify-center py-12">{content}</div>;
}
