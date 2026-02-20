import { useAuth } from '@/hooks/useAuth';
import AuthPage from './AuthPage';
import ChatPage from './ChatPage';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center animate-fade-in">
          <div className="h-12 w-12 mx-auto rounded-xl bg-primary/10 animate-pulse-glow flex items-center justify-center mb-3">
            <span className="font-mono text-primary text-xl font-bold">C</span>
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;
  return <ChatPage />;
};

export default Index;
