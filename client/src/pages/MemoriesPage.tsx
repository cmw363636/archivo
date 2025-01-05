import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { Memory } from "@db/schema";
import { format } from "date-fns";

export default function MemoriesPage() {
  const params = useParams();
  const userId = params.id ? parseInt(params.id) : undefined;

  const { data: memories = [], isLoading } = useQuery<Memory[]>({
    queryKey: ["/api/memories", userId],
    enabled: !!userId,
  });

  const { data: user } = useQuery({
    queryKey: ["/api/users", userId],
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-4">
          <div className="h-[200px] w-full bg-muted animate-pulse rounded-lg" />
          <div className="h-[200px] w-full bg-muted animate-pulse rounded-lg" />
          <div className="h-[200px] w-full bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <Link href={`/profile/${userId}`}>
            <Button variant="ghost" className="flex items-center gap-2 -ml-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Profile
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">
            {user?.displayName || user?.username}'s Memories
          </h1>
        </div>

        <div className="grid gap-6">
          {memories.map((memory) => (
            <Card key={memory.id}>
              <CardHeader>
                <CardTitle>{memory.title}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(memory.createdAt), 'PPP')}
                </p>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{memory.content}</p>
              </CardContent>
            </Card>
          ))}

          {memories.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No memories shared yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
