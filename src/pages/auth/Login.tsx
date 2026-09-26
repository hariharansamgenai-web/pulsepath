import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError(signInError);
      setLoading(false);
    } else {
      navigate(from, { replace: true });
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const { error: googleError } = await signInWithGoogle();
    if (googleError) {
      setError(googleError);
      setGoogleLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          {/* Large heart logo — matches reference */}
          <div style={{ width:120, height:120, borderRadius:28, background:'#000', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16, boxShadow:'0 0 48px rgba(139,92,246,.5), 0 0 48px rgba(251,146,60,.4), 0 8px 32px rgba(0,0,0,.8)' }}>
            <svg width="90" height="84" viewBox="0 0 60 56" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="lg3" cx="38%" cy="28%" r="65%">
                  <stop offset="0%"   stopColor="#8b5cf6"/>
                  <stop offset="35%"  stopColor="#6d28d9"/>
                  <stop offset="70%"  stopColor="#4338ca"/>
                  <stop offset="100%" stopColor="#1e3a8a"/>
                </radialGradient>
                <radialGradient id="rg3" cx="62%" cy="22%" r="68%">
                  <stop offset="0%"   stopColor="#fef08a"/>
                  <stop offset="30%"  stopColor="#fbbf24"/>
                  <stop offset="65%"  stopColor="#f97316"/>
                  <stop offset="100%" stopColor="#c2410c"/>
                </radialGradient>
                <radialGradient id="mg3" cx="50%" cy="55%" r="70%">
                  <stop offset="0%"   stopColor="#db2777" stopOpacity="0.95"/>
                  <stop offset="40%"  stopColor="#9333ea" stopOpacity="0.85"/>
                  <stop offset="80%"  stopColor="#581c87" stopOpacity="0.75"/>
                  <stop offset="100%" stopColor="#1c0533" stopOpacity="0.6"/>
                </radialGradient>
                <clipPath id="lc3">
                  <path d="M30,48 C30,48 4,34 4,19 C4,11 10,6 17,6 C22,6 27,9 30,14 L30,48 Z"/>
                </clipPath>
                <clipPath id="rc3">
                  <path d="M30,48 C30,48 56,34 56,19 C56,11 50,6 43,6 C38,6 33,9 30,14 L30,48 Z"/>
                </clipPath>
              </defs>
              <path d="M30,48 C30,48 4,34 4,19 C4,11 10,6 17,6 C23,6 27,10 30,14 C33,10 37,6 43,6 C50,6 56,11 56,19 C56,34 30,48 30,48 Z" fill="#000"/>
              <path d="M30,48 C30,48 4,34 4,19 C4,11 10,6 17,6 C23,6 27,10 30,14 C33,10 37,6 43,6 C50,6 56,11 56,19 C56,34 30,48 30,48 Z" fill="url(#lg3)" clipPath="url(#lc3)"/>
              <path d="M30,48 C30,48 4,34 4,19 C4,11 10,6 17,6 C23,6 27,10 30,14 C33,10 37,6 43,6 C50,6 56,11 56,19 C56,34 30,48 30,48 Z" fill="url(#rg3)" clipPath="url(#rc3)"/>
              <path d="M30,14 C26,19 23,26 23,31 C23,39 26,44 30,48 C34,44 37,39 37,31 C37,26 34,19 30,14 Z" fill="url(#mg3)" opacity="0.9"/>
            </svg>
          </div>
          {/* Gold gradient wordmark */}
          <h1 style={{ fontSize:32, fontWeight:900, letterSpacing:'-.04em', lineHeight:1, background:'linear-gradient(135deg, #fde68a 0%, #f59e0b 45%, #d97706 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', marginBottom:4 }}>
            PulsePath
          </h1>
          {/* Gold tagline */}
          <p style={{ fontSize:11, fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', background:'linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', marginBottom:4 }}>
            Small habits · Brighter days
          </p>
          <p style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>Sign in to your account</p>
        </div>

        <div className="card-base space-y-4 p-6">
          <Button
            type="button"
            variant="outline"
            loading={googleLoading}
            onClick={handleGoogle}
            className="w-full"
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-200" />
            <span className="text-xs text-neutral-400">or</span>
            <div className="h-px flex-1 bg-neutral-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="h-4 w-4" />}
              required
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              name="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="h-4 w-4" />}
              required
              autoComplete="current-password"
            />

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Forgot password?
              </Link>
            </div>

            {error && (
              <p className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-600">{error}</p>
            )}

            <Button type="submit" loading={loading} className="w-full">
              Sign in
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="text-center text-sm text-neutral-500">
            Don't have an account?{' '}
            <Link to="/register" className="font-medium text-primary-600 hover:text-primary-700">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
