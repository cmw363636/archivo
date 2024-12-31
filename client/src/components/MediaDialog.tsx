import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link2, Trash2, UserPlus, FolderPlus, X } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { MediaItem } from "@db/schema";
import TagUsers from "./TagUsers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface MediaDialogProps {
  media: MediaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MediaDialog({ media, open, onOpenChange }: MediaDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isAddToAlbumOpen, setIsAddToAlbumOpen] = useState(false);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("");

  const { data: albums = [] } = useQuery<any[]>({
    queryKey: ["/api/albums"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (mediaId: number) => {
      const response = await fetch(`/api/media/${mediaId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
      queryClient.invalidateQueries({ queryKey: ['/api/media/tagged'] });
      onOpenChange(false);
      toast({
        title: "Success",
        description: "Media deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
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

  const removeFromAlbumMutation = useMutation({
    mutationFn: async ({ albumId, mediaId }: { albumId: number; mediaId: number }) => {
      const response = await fetch(`/api/albums/${albumId}/media/${mediaId}`, {
        method: "DELETE",
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
        description: "Media removed from album successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this media item?')) {
      deleteMutation.mutate(media!.id);
    }
  };

  const handleAddToAlbum = () => {
    if (!media || !selectedAlbumId) return;

    addToAlbumMutation.mutate({
      albumId: parseInt(selectedAlbumId),
      mediaId: media.id,
    });
  };

  const handleRemoveFromAlbum = (albumId: number) => {
    if (!media) return;

    if (window.confirm('Are you sure you want to remove this media from the album?')) {
      removeFromAlbumMutation.mutate({
        albumId,
        mediaId: media.id,
      });
    }
  };

  // Get the list of albums this media is not in yet
  const availableAlbums = albums.filter(album => 
    media?.albumId !== album.id
  );

  // Get the current album if media is in one
  const currentAlbum = albums.find(album => album.id === media?.albumId);

  if (!media) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader className="mb-4">
          <div className="flex items-center justify-between pr-12">
            <DialogTitle>{media.title}</DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsTagModalOpen(true)}
                className="h-8 w-8"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsAddToAlbumOpen(true)}
                className="h-8 w-8"
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="h-8 w-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <Card>
          <CardContent className="p-6">
            {media.type === "photo" && (
              <img
                src={media.url}
                alt={media.title}
                className="w-full rounded-lg object-cover max-h-[70vh]"
              />
            )}
            {media.type === "video" && (
              <video
                controls
                src={media.url}
                className="w-full rounded-lg"
              />
            )}
            {media.type === "audio" && (
              <audio
                controls
                src={media.url}
                className="w-full"
              />
            )}
            {media.type === "post" && media.url && (
              <img
                src={media.url}
                alt={media.title}
                className="w-full rounded-lg object-cover max-h-[70vh]"
              />
            )}
            <div className="mt-4">
              {media.description && (
                <p className="mt-2 text-muted-foreground">{media.description}</p>
              )}
              {media.type === "post" && media.website_url && (
                <div className="mt-1 flex items-center gap-1 text-sm text-primary">
                  <Link2 className="h-3 w-3" />
                  <a
                    href={media.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    Visit Website
                  </a>
                </div>
              )}
              {media.type === "post" && media.content && (
                <p className="mt-4 whitespace-pre-wrap">{media.content}</p>
              )}

              {/* Current Album Section */}
              {currentAlbum && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Current Album: </span>
                      <span className="font-medium">{currentAlbum.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFromAlbum(currentAlbum.id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tag Users Dialog */}
        <Dialog open={isTagModalOpen} onOpenChange={setIsTagModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tag Users</DialogTitle>
              <DialogDescription>
                Select users to tag in this media
              </DialogDescription>
            </DialogHeader>
            <TagUsers mediaId={media.id} onClose={() => setIsTagModalOpen(false)} />
          </DialogContent>
        </Dialog>

        {/* Add to Album Dialog */}
        <Dialog
          open={isAddToAlbumOpen}
          onOpenChange={(open) => {
            setIsAddToAlbumOpen(open);
            if (!open) {
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
                  {availableAlbums.map((album) => (
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
      </DialogContent>
    </Dialog>
  );
}