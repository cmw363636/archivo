import { useState } from "react";
import { useMedia, type MediaItem } from "../hooks/use-media";
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
  Image,
  FileText,
  Music,
  Video,
  Search,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";

export default function MediaGallery() {
  const { mediaItems, isLoading } = useMedia();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredItems = mediaItems.filter((item) => {
    const matchesSearch = item.title
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesType =
      typeFilter === "all" || item.type === typeFilter;
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
      default:
        return <FileText className="h-5 w-5" />;
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

  const renderMediaContent = (item: MediaItem) => {
    switch (item.type) {
      case "photo":
        return (
          <img
            src={item.url}
            alt={item.title}
            className="w-full h-48 object-cover rounded-md"
          />
        );
      case "video":
        return (
          <div className="w-full h-48 bg-muted rounded-md flex flex-col items-center justify-center p-4">
            <video
              controls
              className="w-full h-full rounded-md"
              preload="metadata"
              crossOrigin="anonymous"
              playsInline
              controlsList="nodownload"
              onError={(e) => {
                console.error('Video playback error:', e);
                const video = e.currentTarget;
                if (video.error) {
                  console.error('Video error details:', {
                    code: video.error.code,
                    message: video.error.message,
                    networkState: video.networkState,
                    readyState: video.readyState,
                    currentSrc: video.currentSrc,
                  });
                }
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
              controls
              className="w-full max-w-md"
              preload="metadata"
              crossOrigin="anonymous"
              controlsList="nodownload"
              onError={(e) => {
                console.error('Audio playback error:', e);
                const audio = e.currentTarget;
                if (audio.error) {
                  console.error('Audio error details:', {
                    code: audio.error.code,
                    message: audio.error.message,
                    networkState: audio.networkState,
                    readyState: audio.readyState,
                    currentSrc: audio.currentSrc,
                  });
                }
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
              {item.description && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.description}
                </p>
              )}
            </CardContent>
            <CardFooter className="text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(item.createdAt), "PPP")}
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
    </div>
  );
}