import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link2, Trash2, UserPlus, FolderPlus, X, Pencil, CalendarIcon } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { MediaItem } from "@db/schema";
import TagUsers from "./TagUsers";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface MediaDialogProps {
  media: MediaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TaggedUser {
  id: number;
  mediaId: number;
  userId: number;
  user: {
    id: number;
    username: string;
    displayName?: string;
  };
}

export function MediaDialog({ media, open, onOpenChange }: MediaDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isAddToAlbumOpen, setIsAddToAlbumOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("");
  const [editMediaDate, setEditMediaDate] = useState<Date | undefined>(undefined);

  const { data: albums = [] } = useQuery<any[]>({
    queryKey: ["/api/albums"],
  });

  // Get tagged users for the media item
  const { data: taggedUsers = [] } = useQuery<TaggedUser[]>({
    queryKey: ['/api/media/tags', media?.id],
    enabled: !!media?.id,
  });

  // Reset edit form when media changes
  useEffect(() => {
    if (media) {
      setEditTitle(media.title || "");
      setEditDescription(media.description || "");
      setEditMediaDate(media.mediaDate ? new Date(media.mediaDate) : undefined);
    }
  }, [media]);

  const editMutation = useMutation({
    mutationFn: async ({ mediaId, title, description, mediaDate }: { mediaId: number; title?: string; description?: string; mediaDate?: Date }) => {
      const response = await fetch(`/api/media/${mediaId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ title, description, mediaDate }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
      queryClient.invalidateQueries({ queryKey: ['/api/media/tagged'] });
      setIsEditMode(false);
      toast({
        title: "Success",
        description: "Media updated successfully",
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

  const handleEdit = () => {
    if (!media) return;

    editMutation.mutate({
      mediaId: media.id,
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      mediaDate: editMediaDate,
    });
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
        <DialogHeader>
          <div className="flex items-center justify-between pr-12">
            {isEditMode ? (
              <div className="flex-1 mr-4">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Enter title"
                  className="mb-2"
                />
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Enter description"
                  rows={3}
                  className="mb-2"
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal mb-2",
                        !editMediaDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editMediaDate ? format(editMediaDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editMediaDate}
                      onSelect={setEditMediaDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex gap-2">
                  <Button onClick={handleEdit} disabled={editMutation.isPending}>
                    Save
                  </Button>
                  <Button variant="ghost" onClick={() => setIsEditMode(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <DialogTitle>{media.title}</DialogTitle>
                  {media.mediaDate && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {format(new Date(media.mediaDate), "PPP")}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsEditMode(true)}
                    className="h-8 w-8"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
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
              </>
            )}
          </div>
        </DialogHeader>
        <Card>
          <CardContent className="p-6">
            {media.type === "photo" && (
              <img
                src={media.url || ''}
                alt={media.title || ''}
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
                src={media.url || ''}
                alt={media.title || ''}
                className="w-full rounded-lg object-cover max-h-[70vh]"
              />
            )}

            <div className="mt-4 space-y-4">
              {/* User Information Section */}
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm">
                  <div className="mb-2">
                    <span className="text-muted-foreground">Uploaded by: </span>
                    <span className="font-medium">{media.user?.displayName || media.user?.username}</span>
                  </div>
                  {taggedUsers.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Tagged users: </span>
                      <span className="font-medium">
                        {taggedUsers.map(tag => tag.user?.displayName || tag.user?.username).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Current Album Section */}
              {currentAlbum && (
                <div className="p-3 bg-muted rounded-lg">
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

              {/* Media Description and Content */}
              {media.description && (
                <p className="text-muted-foreground">{media.description}</p>
              )}
              {media.type === "post" && media.website_url && (
                <div className="flex items-center gap-1 text-sm text-primary">
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
                <p className="whitespace-pre-wrap">{media.content}</p>
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