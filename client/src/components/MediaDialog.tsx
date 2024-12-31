import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link2, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { MediaItem } from "@db/schema";

interface MediaDialogProps {
  media: MediaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MediaDialog({ media, open, onOpenChange }: MediaDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      // Invalidate all queries that might contain the deleted media
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

  if (!media) return null;

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this media item?')) {
      deleteMutation.mutate(media.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader className="mb-4">
          <div className="flex items-center justify-between">
            <DialogTitle>{media.title}</DialogTitle>
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
                <div className="mt-4 flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  <a
                    href={media.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    Visit Website
                  </a>
                </div>
              )}
              {media.type === "post" && media.content && (
                <p className="mt-4 whitespace-pre-wrap">{media.content}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}