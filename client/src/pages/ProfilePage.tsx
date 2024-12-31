import { UserProfileEditor } from "../components/UserProfileEditor";
import { useUser } from "../hooks/use-user";
import FamilyTree from "../components/FamilyTree";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MediaItem } from "@db/schema";

export default function ProfilePage() {
  const { user } = useUser();

  const { data: taggedMedia = [] } = useQuery<MediaItem[]>({
    queryKey: ["/api/media/tagged", user?.id],
    enabled: !!user,
  });

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="grid gap-8 md:grid-cols-2">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Username</h3>
                <p className="text-muted-foreground">{user.username}</p>
              </div>
              <div>
                <h3 className="text-lg font-medium">Birthday</h3>
                <UserProfileEditor />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tagged Media */}
        <Card>
          <CardHeader>
            <CardTitle>Tagged Media</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {taggedMedia.length > 0 ? (
                taggedMedia.map((media) => (
                  <div key={media.id} className="flex items-center gap-4">
                    {media.type === 'photo' && (
                      <img 
                        src={media.url} 
                        alt={media.title}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                    )}
                    <div>
                      <h4 className="font-medium">{media.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {media.description}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No tagged media</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Family Tree */}
      <Card>
        <CardHeader>
          <CardTitle>Family Tree</CardTitle>
        </CardHeader>
        <CardContent>
          <FamilyTree />
        </CardContent>
      </Card>
    </div>
  );
}
