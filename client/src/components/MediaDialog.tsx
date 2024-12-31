import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link2 } from "lucide-react";
import type { MediaItem } from "@db/schema";

interface MediaDialogProps {
  media: MediaItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MediaDialog({ media, open, onOpenChange }: MediaDialogProps) {
  if (!media) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
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
              <h3 className="text-xl font-semibold">{media.title}</h3>
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
