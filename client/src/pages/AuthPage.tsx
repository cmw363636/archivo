import { useState } from "react";
import { useUser } from "../hooks/use-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(false); // Start with registration view
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const { login, register } = useUser();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isLogin) {
        await login({ 
          username, 
          password,
          displayName: username // This field is required by the schema but not used for login
        });
      } else {
        await register({ 
          username, 
          password,
          displayName: displayName || username 
        });
      }
      // Reset form after successful submission
      setUsername("");
      setPassword("");
      setDisplayName("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            {isLogin ? "Welcome Back" : "Create Your Account"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-white"
                disabled={isSubmitting}
                placeholder="Enter your username"
              />
            </div>
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How should we call you?"
                  className="bg-white"
                  disabled={isSubmitting}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white"
                disabled={isSubmitting}
                placeholder="Enter your password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLogin ? "Logging in..." : "Creating Account..."}
                </>
              ) : (
                isLogin ? "Login" : "Create Account"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setIsLogin(!isLogin)}
              disabled={isSubmitting}
            >
              {isLogin ? "Need an account?" : "Already have an account?"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}