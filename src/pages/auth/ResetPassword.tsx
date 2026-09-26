import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, Lock, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await updatePassword(password);
    if (updateError) {
      setError(updateError);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
      setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-sm">
          <div className="card-base p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-100">
              <CheckCircle className="h-6 w-6 text-success-600" />
            </div>
            <h2 className="mb-2 text-base font-semibold text-neutral-900">Password updated</h2>
            <p className="text-sm text-neutral-600">
              Your password has been changed. Redirecting you to your dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600">
            <Activity className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900">Set a new password</h1>
          <p className="mt-1 text-sm text-neutral-500">Enter your new password below</p>
        </div>

        <form onSubmit={handleSubmit} className="card-base space-y-4 p-6">
          <Input
            label="New password"
            type="password"
            name="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock className="h-4 w-4" />}
            required
            autoComplete="new-password"
            helperText="Minimum 8 characters"
          />

          <Input
            label="Confirm password"
            type="password"
            name="confirmPassword"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            leftIcon={<Lock className="h-4 w-4" />}
            required
            autoComplete="new-password"
          />

          {error && (
            <p className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-600">{error}</p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Update password
            <ArrowRight className="h-4 w-4" />
          </Button>

          <p className="text-center text-sm text-neutral-500">
            <Link to="/login" className="font-medium text-primary-600 hover:text-primary-700">
              Back to sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
