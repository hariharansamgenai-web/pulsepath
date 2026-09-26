import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100">
        <Activity className="h-8 w-8 text-primary-600" />
      </div>
      <h1 className="mb-2 text-3xl font-bold text-neutral-900">Page not found</h1>
      <p className="mb-8 text-sm text-neutral-600">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/dashboard"
        className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
