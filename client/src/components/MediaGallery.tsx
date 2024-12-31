import { useState } from "react";
import { useMedia } from "../hooks/use-media";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Image,
  FileText,
  Music,
  Video,
  Search,
  Calendar,
  AlertCircle,
  ExternalLink,
  Link as LinkIcon,
  FolderPlus,
  Tag,
  UserPlus,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import TagUsers from "./TagUsers";

enum MediaError {
  MEDIA_ERR_ABORTED = 1,
  MEDIA_ERR_NETWORK = 2,
  MEDIA_ERR_DECODE = 3,
  MEDIA_ERR_SRC_NOT_SUPPORTED = 4,
}

interface MediaItem {
  id: number;
  title: string;
  type: string;
  url: string;
  description?: string | null;
  websiteUrl?: string | null;
  content?: string | null;
  createdAt: string;
  metadata?: { mimetype?: string };
  tags?: Array<{
    userId: number;
    user: {
      username: string;
      displayName: string;
    };
  }>;
}

interface Album {
  id: number;
  name: string;
}

interface MediaGalleryProps {
  albumId?: number;
}

export function MediaGallery({ albumId }: MediaGalleryProps) {
  const { mediaItems, isLoading } = useMedia(albumId);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [mediaErrors, setMediaErrors] = useState<Record<number, string>>({});
  const [isAddToAlbumOpen, setIsAddToAlbumOpen] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isTagUsersOpen, setIsTagUsersOpen] = useState(false);
  const [selectedMediaForTags, setSelectedMediaForTags] = useState<number | null>(null);

  const { data: albums = [] } = useQuery<Album[]>({
    queryKey: ["/api/albums"],
  });

  const addToAlbumMutation = useMutation({
    mutationFn: async ({ albumId, mediaId }: { albumId: number; mediaId: number }) => {
      const response = await fetch(`/api/albums/${albumId}/media/${mediaId}`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      queryClient.invalidateQueries({ queryKey: ["/api/albums"] });
      toast({
        title: "Success",
        description: "Media added to album successfully",
      });
      setIsAddToAlbumOpen(false);
      setSelectedMediaId(null);
      setSelectedAlbumId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddToAlbum = () => {
    if (!selectedMediaId || !selectedAlbumId) return;

    addToAlbumMutation.mutate({
      albumId: parseInt(selectedAlbumId),
      mediaId: selectedMediaId,
    });
  };

  const filteredItems = mediaItems.filter((item) => {
    const matchesSearch = item.title
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const MediaIcon = ({ type }: { type: string }) => {
    switch (type) {
      case "photo":
        return <Image className="h-5 w-5" />;
      case "video":
        return <Video className="h-5 w-5" />;
      case "audio":
        return <Music className="h-5 w-5" />;
      case "post":
        return <LinkIcon className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const handleMediaError = (error: Error, mediaType: string, element: HTMLMediaElement) => {
    console.error(`${mediaType} playback error:`, {
      error,
      networkState: element.networkState,
      readyState: element.readyState,
      currentSrc: element.currentSrc,
      error: element.error
    });

    let errorMessage = `Error playing ${mediaType}`;
    if (element.error) {
      switch (element.error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage += ": Playback aborted";
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage += ": Network error";
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage += ": Decoding error";
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage += ": Format not supported";
          break;
        default:
          errorMessage += `: ${element.error.message}`;
      }
    }

    setMediaErrors(prev => ({
      ...prev,
      [element.dataset.itemId!]: errorMessage
    }));
  };

  const renderMediaContent = (item: MediaItem) => {
    switch (item.type) {
      case "post":
        return (
          <div className="w-full space-y-4">
            {item.content && (
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {item.content}
              </p>
            )}
            {item.websiteUrl && (
              <a
                href={item.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Visit Website
              </a>
            )}
          </div>
        );
      case "photo":
        return (
          <img
            src={item.url}
            alt={item.title}
            className="w-full h-48 object-cover rounded-md"
            onError={(e) => {
              const img = e.currentTarget;
              handleMediaError(e as any as Error, "image", img as any);
            }}
          />
        );
      case "video":
        return (
          <div className="w-full h-48 bg-muted rounded-md flex flex-col items-center justify-center p-4">
            <video
              data-item-id={item.id}
              controls
              className="w-full h-full rounded-md"
              preload="metadata"
              crossOrigin="anonymous"
              playsInline
              controlsList="nodownload"
              onError={(e) => {
                const video = e.currentTarget;
                handleMediaError(e as any as Error, "video", video);
              }}
              onLoadStart={(e) => {
                const video = e.currentTarget;
                video.volume = 0.5;
              }}
            >
              <source
                src={item.url}
                type={item.metadata?.mimetype || 'video/mp4'}
              />
              Your browser does not support the video element.
            </video>
          </div>
        );
      case "audio":
        return (
          <div className="w-full h-48 bg-muted rounded-md flex flex-col items-center justify-center p-4">
            <Music className="h-8 w-8 mb-4" />
            <audio
              data-item-id={item.id}
              controls
              className="w-full max-w-md"
              preload="metadata"
              crossOrigin="anonymous"
              controlsList="nodownload"
              onError={(e) => {
                const audio = e.currentTarget;
                handleMediaError(e as any as Error, "audio", audio);
              }}
              onLoadStart={(e) => {
                const audio = e.currentTarget;
                audio.volume = 0.5;
              }}
            >
              <source
                src={item.url}
                type={item.metadata?.mimetype || 'audio/mpeg'}
              />
              Your browser does not support the audio element.
            </audio>
          </div>
        );
      default:
        return (
          <div className="w-full h-48 bg-muted rounded-md flex items-center justify-center">
            <MediaIcon type={item.type} />
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search media..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={setTypeFilter}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="photo">Photos</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="post">Posts</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MediaIcon type={item.type} />
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderMediaContent(item)}
              {mediaErrors[item.id] && (
                <div className="mt-2 p-2 bg-destructive/10 text-destructive rounded-md flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {mediaErrors[item.id]}
                </div>
              )}
              {item.description && item.type !== 'post' && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              )}
            </CardContent>
            <CardFooter className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(item.createdAt), "PPP")}
                </div>
                {item.tags && item.tags.length > 0 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Tag className="h-4 w-4" />
                    {item.tags.length} {item.tags.length === 1 ? 'person' : 'people'}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {!albumId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedMediaId(item.id);
                      setIsAddToAlbumOpen(true);
                    }}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Add to Album
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedMediaForTags(item.id);
                    setIsTagUsersOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Tag Users
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No media items found.
        </div>
      )}

      {/* Add to Album Dialog */}
      <Dialog
        open={isAddToAlbumOpen}
        onOpenChange={(open) => {
          setIsAddToAlbumOpen(open);
          if (!open) {
            setSelectedMediaId(null);
            setSelectedAlbumId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Album</DialogTitle>
            <DialogDescription>
              Select an album to add this media item to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value={selectedAlbumId}
              onValueChange={setSelectedAlbumId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select album" />
              </SelectTrigger>
              <SelectContent>
                {albums.map((album) => (
                  <SelectItem key={album.id} value={album.id.toString()}>
                    {album.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              disabled={!selectedAlbumId}
              onClick={handleAddToAlbum}
            >
              Add to Album
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tag Users Dialog */}
      {selectedMediaForTags && (
        <TagUsers
          mediaId={selectedMediaForTags}
          open={isTagUsersOpen}
          onOpenChange={(open) => {
            setIsTagUsersOpen(open);
            if (!open) {
              setSelectedMediaForTags(null);
            }
          }}
        />
      )}
    </div>
  );
}