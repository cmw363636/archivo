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

export default function MediaUpload() {
  const { upload, isUploading } = useMedia();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("photo");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("type", type);
    formData.append("title", title);
    formData.append("description", description);

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
              onValueChange={setType}
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
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  accept="image/*"
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
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  required
                />
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