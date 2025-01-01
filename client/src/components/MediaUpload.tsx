import { useState } from "react";
import { useMedia } from "../hooks/use-media";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Album {
  id: number;
  name: string;
  createdBy: number;
}

export default function MediaUpload() {
  const { upload, isUploading } = useMedia();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("photo");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("");

  const { data: albums = [] } = useQuery<Album[]>({
    queryKey: ["/api/albums"],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (type !== "post" && !file) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("type", type);
    formData.append("title", title);
    formData.append("description", description);
    if (selectedAlbumId) {
      formData.append("albumId", selectedAlbumId);
    }

    if (type === "post") {
      formData.append("websiteUrl", websiteUrl);
      formData.append("content", content);
      // For posts, we don't require a file
      if (file) {
        formData.append("file", file);
      }
    } else {
      if (!file) return;
      formData.append("file", file);
    }

    try {
      await upload(formData);
      setOpen(false);
      resetForm();
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  const resetForm = () => {
    setType("photo");
    setTitle("");
    setDescription("");
    setWebsiteUrl("");
    setContent("");
    setFile(null);
    setSelectedAlbumId("");
  };

  const getAcceptTypes = (type: string) => {
    switch (type) {
      case "photo":
        return "image/*";
      case "video":
        return "video/*";
      case "audio":
        return "audio/*";
      case "document":
        return ".pdf,.doc,.docx,.txt";
      default:
        return "image/*";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    // Validate file size (max 50MB)
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "File size must be less than 50MB",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="h-4 w-4 mr-2" />
          Upload Media
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Media</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value);
                setFile(null); // Reset file when type changes
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="photo">Photo</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="post">Post</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="album">Album (optional)</Label>
            <Select
              value={selectedAlbumId}
              onValueChange={setSelectedAlbumId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select album" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No Album</SelectItem>
                {albums.map((album) => (
                  <SelectItem key={album.id} value={album.id.toString()}>
                    {album.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {type === "post" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Website URL (optional)</Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Image (optional)</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*"
                  capture="environment"
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">File</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={handleFileChange}
                  accept={getAcceptTypes(type)}
                  capture={type === "photo" ? "environment" : undefined}
                  required
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                {file && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Selected: {file.name}
                  </p>
                )}
              </div>
            </>
          )}

          <Button type="submit" disabled={isUploading} className="w-full">
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}