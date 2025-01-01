import { useState } from "react";
import { useMedia } from "../hooks/use-media";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Image, FileText, Music, Video, Search, Link as LinkIcon, FolderPlus, UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MediaDialog } from "./MediaDialog";
import TagUsers from "./TagUsers";
import type { MediaItem } from "@db/schema";

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
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isAddToAlbumOpen, setIsAddToAlbumOpen] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("");
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
    const matchesSearch = !search || (item.title?.toLowerCase() || '').includes(search.toLowerCase());
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

  const renderMediaPreview = (item: MediaItem) => {
    switch (item.type) {
      case "photo":
        return (
          <img
            src={item.url}
            alt={item.title || ''}
            className="w-full h-48 object-cover rounded-md"
          />
        );
      case "video":
        return (
          <div className="w-full h-48 bg-muted rounded-md flex flex-col items-center justify-center p-4">
            <Video className="h-8 w-8 mb-2" />
            <span className="text-sm text-muted-foreground">Video</span>
          </div>
        );
      case "audio":
        return (
          <div className="w-full h-48 bg-muted rounded-md flex flex-col items-center justify-center p-4">
            <Music className="h-8 w-8 mb-2" />
            <span className="text-sm text-muted-foreground">Audio</span>
          </div>
        );
      case "post":
        if (item.url) {
          return (
            <img
              src={item.url}
              alt={item.title || ''}
              className="w-full h-48 object-cover rounded-md"
            />
          );
        }
        return (
          <div className="w-full h-48 bg-muted rounded-md flex flex-col items-center justify-center p-4">
            <LinkIcon className="h-8 w-8 mb-2" />
            <span className="text-sm text-muted-foreground">Post</span>
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
              <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-48 w-full bg-muted animate-pulse rounded" />
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="photo">Photos</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="audio">Audio</SelectItem>
            <SelectItem value="post">Posts</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <Card key={item.id} className="cursor-pointer hover:bg-accent/5 transition-colors" onClick={() => setSelectedMedia(item as MediaItem)}>
            <CardHeader>
              {item.title && (
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MediaIcon type={item.type} />
                  {item.title}
                </CardTitle>
              )}
            </CardHeader>
            <CardContent>
              {renderMediaPreview(item)}
              <div className="mt-4 flex justify-end gap-2">
                {!albumId && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMediaId(item.id);
                        setIsTagModalOpen(true);
                      }}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Tag Users
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMediaId(item.id);
                        setIsAddToAlbumOpen(true);
                      }}
                    >
                      <FolderPlus className="h-4 w-4 mr-2" />
                      Add to Album
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No media items found.
        </div>
      )}

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

      <Dialog
        open={isTagModalOpen}
        onOpenChange={(open) => {
          setIsTagModalOpen(open);
          if (!open) {
            setSelectedMediaId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tag Users</DialogTitle>
            <DialogDescription>
              Select users to tag in this media
            </DialogDescription>
          </DialogHeader>
          {selectedMediaId && (
            <TagUsers 
              mediaId={selectedMediaId} 
              onClose={() => setIsTagModalOpen(false)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <MediaDialog
        media={selectedMedia}
        open={!!selectedMedia}
        onOpenChange={(open) => !open && setSelectedMedia(null)}
      />
    </div>
  );
}