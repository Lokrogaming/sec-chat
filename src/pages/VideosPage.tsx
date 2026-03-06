import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Heart, MessageCircle, Share2, Bookmark, ArrowLeft, Upload, Play, Pause,
  UserPlus, UserCheck, Send, X, Trash2, Volume2, VolumeX
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Video {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  expires_at: string;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: { display_name: string | null; avatar_url: string | null };
}

interface CreatorProfile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function VideosPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCreator, setIsCreator] = useState(false);
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const [savedVideos, setSavedVideos] = useState<Set<string>>(new Set());
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<Map<string, CreatorProfile>>(new Map());
  const [comments, setComments] = useState<Comment[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [playing, setPlaying] = useState<Record<string, boolean>>({});
  const [muted, setMuted] = useState(true);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    loadVideos();
    checkCreator();
    loadUserInteractions();
  }, [user]);

  const checkCreator = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['creator', 'admin']);
    setIsCreator(!!data?.length);
  };

  const loadVideos = async () => {
    const { data } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) {
      setVideos(data);
      // Load profiles for all creators
      const creatorIds = [...new Set(data.map(v => v.creator_id))];
      if (creatorIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', creatorIds);
        if (profileData) {
          const map = new Map<string, CreatorProfile>();
          profileData.forEach(p => map.set(p.user_id, p));
          setProfiles(map);
        }
      }
    }
  };

  const loadUserInteractions = async () => {
    if (!user) return;
    const [likesRes, savesRes, followsRes] = await Promise.all([
      supabase.from('video_likes').select('video_id').eq('user_id', user.id),
      supabase.from('video_saves').select('video_id').eq('user_id', user.id),
      supabase.from('follows').select('following_id').eq('follower_id', user.id),
    ]);
    if (likesRes.data) setLikedVideos(new Set(likesRes.data.map(l => l.video_id)));
    if (savesRes.data) setSavedVideos(new Set(savesRes.data.map(s => s.video_id)));
    if (followsRes.data) setFollowedUsers(new Set(followsRes.data.map(f => f.following_id)));
  };

  const loadComments = async (videoId: string) => {
    const { data } = await supabase
      .from('video_comments')
      .select('*')
      .eq('video_id', videoId)
      .order('created_at', { ascending: true });
    if (data) {
      // Fetch profiles for commenters
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profs } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds);
      const profMap = new Map(profs?.map(p => [p.user_id, p]) || []);
      setComments(data.map(c => ({ ...c, profile: profMap.get(c.user_id) || undefined })));
    }
  };

  const toggleLike = async (videoId: string) => {
    if (!user) return;
    if (likedVideos.has(videoId)) {
      await supabase.from('video_likes').delete().eq('video_id', videoId).eq('user_id', user.id);
      setLikedVideos(prev => { const s = new Set(prev); s.delete(videoId); return s; });
      setVideos(vs => vs.map(v => v.id === videoId ? { ...v, like_count: v.like_count - 1 } : v));
    } else {
      await supabase.from('video_likes').insert({ video_id: videoId, user_id: user.id });
      setLikedVideos(prev => new Set(prev).add(videoId));
      setVideos(vs => vs.map(v => v.id === videoId ? { ...v, like_count: v.like_count + 1 } : v));
    }
  };

  const toggleSave = async (videoId: string) => {
    if (!user) return;
    if (savedVideos.has(videoId)) {
      await supabase.from('video_saves').delete().eq('video_id', videoId).eq('user_id', user.id);
      setSavedVideos(prev => { const s = new Set(prev); s.delete(videoId); return s; });
      toast.success('Removed from saved');
    } else {
      await supabase.from('video_saves').insert({ video_id: videoId, user_id: user.id });
      setSavedVideos(prev => new Set(prev).add(videoId));
      toast.success('Video saved');
    }
  };

  const toggleFollow = async (creatorId: string) => {
    if (!user || creatorId === user.id) return;
    if (followedUsers.has(creatorId)) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', creatorId);
      setFollowedUsers(prev => { const s = new Set(prev); s.delete(creatorId); return s; });
      toast.success('Unfollowed');
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: creatorId });
      setFollowedUsers(prev => new Set(prev).add(creatorId));
      toast.success('Following');
    }
  };

  const shareVideo = async (video: Video) => {
    const url = `${window.location.origin}/videos?v=${video.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const addComment = async (videoId: string) => {
    if (!user || !newComment.trim()) return;
    const { error } = await supabase.from('video_comments').insert({
      video_id: videoId,
      user_id: user.id,
      content: newComment.trim(),
    });
    if (error) { toast.error('Failed to comment'); return; }
    setNewComment('');
    loadComments(videoId);
    setVideos(vs => vs.map(v => v.id === videoId ? { ...v, comment_count: v.comment_count + 1 } : v));
  };

  const deleteComment = async (commentId: string, videoId: string) => {
    await supabase.from('video_comments').delete().eq('id', commentId);
    loadComments(videoId);
    setVideos(vs => vs.map(v => v.id === videoId ? { ...v, comment_count: v.comment_count - 1 } : v));
  };

  const uploadVideo = async () => {
    if (!user || !uploadFile || !uploadTitle.trim()) return;
    setUploading(true);
    try {
      const ext = uploadFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('videos').upload(filePath, uploadFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('videos').getPublicUrl(filePath);
      const { error: insertError } = await supabase.from('videos').insert({
        creator_id: user.id,
        title: uploadTitle.trim(),
        description: uploadDesc.trim() || null,
        video_url: urlData.publicUrl,
      });
      if (insertError) throw insertError;

      toast.success('Video uploaded!');
      setShowUpload(false);
      setUploadTitle('');
      setUploadDesc('');
      setUploadFile(null);
      loadVideos();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const togglePlay = (videoId: string) => {
    const video = videoRefs.current.get(videoId);
    if (!video) return;
    if (video.paused) {
      // Pause all other videos
      videoRefs.current.forEach((v, id) => { if (id !== videoId) v.pause(); });
      video.play();
      setPlaying(p => ({ ...Object.fromEntries(Object.keys(p).map(k => [k, false])), [videoId]: true }));
    } else {
      video.pause();
      setPlaying(p => ({ ...p, [videoId]: false }));
    }
  };

  // Snap scroll handling
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;
    const newIndex = Math.round(scrollTop / height);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < videos.length) {
      setCurrentIndex(newIndex);
      setShowComments(false);
      // Auto-play current video, pause others
      videos.forEach((v, i) => {
        const el = videoRefs.current.get(v.id);
        if (el) {
          if (i === newIndex) { el.play().catch(() => {}); setPlaying(p => ({ ...p, [v.id]: true })); }
          else { el.pause(); setPlaying(p => ({ ...p, [v.id]: false })); }
        }
      });
    }
  }, [currentIndex, videos]);

  const currentVideo = videos[currentIndex];

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/chat')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-mono font-bold text-foreground">Videos</h1>
        </div>
        {isCreator && (
          <Dialog open={showUpload} onOpenChange={setShowUpload}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary text-primary-foreground">
                <Upload className="h-4 w-4 mr-1" /> Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Upload Video</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="Title"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  className="bg-input border-border"
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={uploadDesc}
                  onChange={e => setUploadDesc(e.target.value)}
                  className="bg-input border-border"
                />
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Video file (max 250MB)</label>
                  <Input
                    type="file"
                    accept="video/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file && file.size > 250 * 1024 * 1024) {
                        toast.error('File too large (max 250MB)');
                        return;
                      }
                      setUploadFile(file || null);
                    }}
                    className="bg-input border-border"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Videos expire after 7 days automatically.</p>
                <Button
                  onClick={uploadVideo}
                  disabled={uploading || !uploadFile || !uploadTitle.trim()}
                  className="w-full"
                >
                  {uploading ? 'Uploading...' : 'Upload Video'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Video Feed */}
      {videos.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Play className="h-16 w-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg">No videos yet</p>
            {isCreator && <p className="text-sm mt-1">Be the first to upload!</p>}
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-scroll snap-y snap-mandatory"
          style={{ scrollSnapType: 'y mandatory' }}
        >
          {videos.map((video) => {
            const creator = profiles.get(video.creator_id);
            const isLiked = likedVideos.has(video.id);
            const isSaved = savedVideos.has(video.id);
            const isFollowed = followedUsers.has(video.creator_id);
            const isOwnVideo = user?.id === video.creator_id;

            return (
              <div
                key={video.id}
                className="h-full w-full snap-start snap-always relative flex items-center justify-center bg-black"
                style={{ minHeight: '100%' }}
              >
                {/* Video */}
                <video
                  ref={el => { if (el) videoRefs.current.set(video.id, el); }}
                  src={video.video_url}
                  className="h-full w-full object-contain cursor-pointer"
                  loop
                  muted={muted}
                  playsInline
                  onClick={() => togglePlay(video.id)}
                />

                {/* Play/Pause overlay */}
                {!playing[video.id] && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Play className="h-16 w-16 text-white/60" />
                  </div>
                )}

                {/* Bottom info */}
                <div className="absolute bottom-0 left-0 right-16 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-8 w-8 border border-white/20">
                      <AvatarImage src={creator?.avatar_url || undefined} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                        {creator?.display_name?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-white text-sm font-medium">{creator?.display_name || 'Unknown'}</span>
                    {!isOwnVideo && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={`h-6 px-2 text-xs ${isFollowed ? 'text-muted-foreground' : 'text-primary'}`}
                        onClick={() => toggleFollow(video.creator_id)}
                      >
                        {isFollowed ? <UserCheck className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                  <p className="text-white text-sm font-semibold">{video.title}</p>
                  {video.description && (
                    <p className="text-white/70 text-xs mt-1 line-clamp-2">{video.description}</p>
                  )}
                  <p className="text-white/40 text-xs mt-1">
                    Expires {new Date(video.expires_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Right side actions */}
                <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
                  <button onClick={() => toggleLike(video.id)} className="flex flex-col items-center gap-1">
                    <Heart className={`h-7 w-7 ${isLiked ? 'fill-destructive text-destructive' : 'text-white'}`} />
                    <span className="text-white text-xs">{video.like_count}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowComments(!showComments);
                      if (!showComments) loadComments(video.id);
                    }}
                    className="flex flex-col items-center gap-1"
                  >
                    <MessageCircle className="h-7 w-7 text-white" />
                    <span className="text-white text-xs">{video.comment_count}</span>
                  </button>

                  <button onClick={() => toggleSave(video.id)} className="flex flex-col items-center gap-1">
                    <Bookmark className={`h-7 w-7 ${isSaved ? 'fill-primary text-primary' : 'text-white'}`} />
                  </button>

                  <button onClick={() => shareVideo(video)} className="flex flex-col items-center gap-1">
                    <Share2 className="h-7 w-7 text-white" />
                  </button>

                  <button onClick={() => setMuted(!muted)} className="flex flex-col items-center gap-1">
                    {muted ? <VolumeX className="h-6 w-6 text-white/60" /> : <Volume2 className="h-6 w-6 text-white" />}
                  </button>
                </div>

                {/* Comments panel */}
                {showComments && currentVideo?.id === video.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-[50%] bg-card/95 backdrop-blur-md rounded-t-2xl border-t border-border flex flex-col z-20">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <h3 className="text-sm font-semibold text-foreground">Comments ({video.comment_count})</h3>
                      <Button size="icon" variant="ghost" onClick={() => setShowComments(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
                      {comments.length === 0 && (
                        <p className="text-center text-muted-foreground text-sm py-8">No comments yet</p>
                      )}
                      {comments.map(c => (
                        <div key={c.id} className="flex gap-2">
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={c.profile?.avatar_url || undefined} />
                            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                              {c.profile?.display_name?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground">
                              {c.profile?.display_name || 'User'}
                              <span className="text-muted-foreground font-normal ml-2">
                                {new Date(c.created_at).toLocaleString()}
                              </span>
                            </p>
                            <p className="text-sm text-foreground/80">{c.content}</p>
                          </div>
                          {c.user_id === user?.id && (
                            <Button size="icon" variant="ghost" className="shrink-0 h-6 w-6 text-destructive" onClick={() => deleteComment(c.id, video.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 px-4 py-3 border-t border-border">
                      <Input
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="bg-input border-border flex-1"
                        onKeyDown={e => e.key === 'Enter' && addComment(video.id)}
                      />
                      <Button size="icon" onClick={() => addComment(video.id)} disabled={!newComment.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
