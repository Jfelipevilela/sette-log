type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = 'Carregando dados...' }: LoadingStateProps) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-fleet-line bg-white p-6">
      <div className="flex items-center gap-3 text-sm text-zinc-600">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-fleet-green border-t-transparent" />
        {label}
      </div>
    </div>
  );
}
