import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import ChatSidebar from '@/components/ChatSidebar';
import ChatView from '@/components/ChatView';
import ProfilePage from '@/pages/ProfilePage';
import { Shield, Lock } from 'lucide-react';

export default function ChatPage() {
  const { user } = useAuth();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [showProfile, setShowProfile] = useState(false);

  const handleSelectConversation = (convId: string, other: any) => {
    setSelectedConversation(convId);
    setOtherUser(other);
    setShowProfile(false);
  };

  if (showProfile) {
    return (
      <div className="flex h-screen bg-background">
        <div className="w-80 shrink-0 hidden md:block">
          <ChatSidebar
            onSelectConversation={handleSelectConversation}
            onOpenProfile={() => setShowProfile(true)}
            selectedConversationId={selectedConversation}
          />
        </div>
        <div className="flex-1">
          <ProfilePage onBack={() => setShowProfile(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - hidden on mobile when conversation selected */}
      <div className={`w-full md:w-80 shrink-0 ${selectedConversation ? 'hidden md:block' : ''}`}>
        <ChatSidebar
          onSelectConversation={handleSelectConversation}
          onOpenProfile={() => setShowProfile(true)}
          selectedConversationId={selectedConversation}
        />
      </div>

      {/* Chat area */}
      <div className={`flex-1 ${!selectedConversation ? 'hidden md:flex' : 'flex'} flex-col`}>
        {selectedConversation ? (
          <>
            {/* Mobile back button */}
            <div className="md:hidden">
              <button
                onClick={() => setSelectedConversation(null)}
                className="p-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ChatView conversationId={selectedConversation} otherUser={otherUser} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center animate-fade-in">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/5 animate-pulse-glow">
                <Shield className="h-10 w-10 text-primary/40" />
              </div>
              <h2 className="font-mono text-xl font-semibold text-foreground mb-2">
                Cipher<span className="text-primary">Chat</span>
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Select a conversation or add a contact to start messaging securely.
              </p>
              <div className="flex items-center justify-center gap-1 mt-3 text-xs text-primary/50">
                <Lock className="h-3 w-3" />
                <span>AES-256-GCM encryption</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
