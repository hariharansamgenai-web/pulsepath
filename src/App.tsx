import { AuthProvider } from '@/context/AuthContext';
import { ActiveProfileProvider } from '@/context/ActiveProfileContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { AppRouter } from '@/routes';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
      <AuthProvider>
        <ActiveProfileProvider>
          <AppRouter />
        </ActiveProfileProvider>
      </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
