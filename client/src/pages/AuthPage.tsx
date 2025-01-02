import { useState } from "react";
import { useUser } from "../hooks/use-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
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
          displayName: username
        });
      } else {
        await register({ 
          username, 
          password,
          displayName: displayName || username,
          email: email || undefined
        });
      }
      setUsername("");
      setPassword("");
      setDisplayName("");
      setEmail("");
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

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, newPassword }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: "Success",
        description: "Password has been reset successfully",
      });
      setIsResetPassword(false);
      setIsLogin(true);
      setUsername("");
      setNewPassword("");
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

  if (isResetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordReset} className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="bg-white"
                  disabled={isSubmitting}
                  placeholder="Enter your new password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setIsResetPassword(false);
                  setUsername("");
                  setNewPassword("");
                }}
                disabled={isSubmitting}
              >
                Back to Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              <>
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
                <div className="space-y-2">
                  <Label htmlFor="email">Email (optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="bg-white"
                    disabled={isSubmitting}
                  />
                </div>
              </>
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
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setUsername("");
                  setPassword("");
                  setDisplayName("");
                  setEmail("");
                }}
                disabled={isSubmitting}
              >
                {isLogin ? "Need an account?" : "Already have an account?"}
              </Button>
              {isLogin && (
                <Button
                  type="button"
                  variant="link"
                  className="w-full text-[#7c6f9f]"
                  onClick={() => setIsResetPassword(true)}
                  disabled={isSubmitting}
                >
                  Forgot Password?
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}