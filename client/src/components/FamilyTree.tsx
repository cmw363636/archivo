import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUser } from "../hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Layout constants for SVG rendering
const SVG_WIDTH = 2400;
const SVG_HEIGHT = 1600;
const CENTER_X = SVG_WIDTH / 2;
const CENTER_Y = SVG_HEIGHT / 2;
const VIEWPORT_WIDTH = 800; // Typical viewport width
const VIEWPORT_HEIGHT = 600; // Typical viewport height

type FamilyMember = {
  id: number;
  username: string;
  displayName: string;
};

type FamilyRelation = {
  id: number;
  fromUserId: number;
  toUserId: number;
  relationType: 'parent' | 'child' | 'sibling' | 'spouse';
  fromUser: FamilyMember;
  toUser: FamilyMember;
};

type FamilyTreeProps = {
  onUserClick?: (userId: number) => void;
  rootUserId?: number;
};

const relationTypeMap = {
  parent: 'child',
  child: 'parent',
  spouse: 'spouse',
  sibling: 'sibling'
} as const;

const newUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  displayName: z.string().min(1, "Display name is required"),
  email: z.string().email("Invalid email").optional(),
  birthday: z.date().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  relationType: z.enum(["parent", "child", "sibling", "spouse"], {
    required_error: "Please select a relation type",
  }),
});

type NewUserFormData = z.infer<typeof newUserSchema>;

function FamilyTree({ onUserClick, rootUserId }: FamilyTreeProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [selectedRelativeMemberId, setSelectedRelativeMemberId] = useState<string>("");
  const [relationType, setRelationType] = useState<string>("");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isAddingRelation, setIsAddingRelation] = useState(false);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [lastPinchDistance, setLastPinchDistance] = useState<number | null>(null);

  // Use rootUserId if provided, otherwise fall back to logged-in user's ID
  const currentUserId = rootUserId ?? user?.id;
  const isOwnTree = currentUserId === user?.id;

  const form = useForm<NewUserFormData>({
    resolver: zodResolver(newUserSchema),
    defaultValues: {
      username: "",
      displayName: "",
      email: "",
      password: "",
    },
  });

  // Initialize position to center on the root user
  useEffect(() => {
    // Calculate the offset needed to center the viewport on the root user
    const initialX = -(CENTER_X - VIEWPORT_WIDTH / 2);
    const initialY = -(CENTER_Y - VIEWPORT_HEIGHT / 2);
    setPosition({ x: initialX, y: initialY });
  }, [currentUserId]); // Reset position when the root user changes

  // Query to get the root user's information
  const { data: rootUser } = useQuery<FamilyMember>({
    queryKey: ["/api/users", currentUserId],
    enabled: !!currentUserId && currentUserId !== user?.id,
  });

  // Display user is either the root user (if viewing someone else's tree) or the logged-in user
  const displayUser = rootUser ?? user;

  // Updated query to fetch relations for the specified user
  const { data: relations = [], isLoading } = useQuery<FamilyRelation[]>({
    queryKey: ["/api/family", currentUserId],
    enabled: !!currentUserId,
  });

  const { data: allUsers = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/users"],
    enabled: !!user && isOwnTree,
  });

  // Only show relations that belong to the viewed user
  const familyGroups = relations.reduce((acc, relation) => {
    if (relation.fromUserId !== currentUserId && relation.toUserId !== currentUserId) {
      return acc;
    }

    const isFromUser = relation.fromUserId === currentUserId;
    const member = isFromUser ? relation.toUser : relation.fromUser;
    const relationType = isFromUser
      ? relation.relationType
      : relationTypeMap[relation.relationType];

    if (!acc[relationType]) {
      acc[relationType] = [];
    }

    if (!acc[relationType].some(m => m.id === member.id)) {
      acc[relationType].push(member);
    }

    return acc;
  }, {} as Record<string, FamilyMember[]>);

  const addRelationMutation = useMutation({
    mutationFn: async (data: { toUserId: number; relationType: string }) => {
      const response = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: data.toUserId,
          relationType: data.relationType,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family"] });
      setIsAddingRelation(false);
      setSelectedRelativeMemberId("");
      setRelationType("");
      toast({
        title: "Success",
        description: "Family relation added successfully",
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
    mutationFn: async (relationId: number) => {
      const response = await fetch(`/api/family/${relationId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family"] });
      toast({
        title: "Success",
        description: "Relationship deleted successfully",
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

  const handleDeleteRelation = async (relationId: number) => {
    try {
      await deleteMutation.mutateAsync(relationId);
    } catch (error) {
      // Error handling is done in mutation callbacks
    }
  };

  const createUserAndRelationMutation = useMutation({
    mutationFn: async (data: NewUserFormData) => {
      const userResponse = await fetch("/api/family/create-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
          displayName: data.displayName,
          email: data.email,
          birthday: data.birthday ? format(data.birthday, "yyyy-MM-dd") : undefined,
        }),
        credentials: "include",
      });

      if (!userResponse.ok) {
        throw new Error(await userResponse.text());
      }

      const { user: newUser } = await userResponse.json();

      const relationResponse = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: newUser.id,
          relationType: data.relationType,
          inheritRelations: true,
        }),
        credentials: "include",
      });

      if (!relationResponse.ok) {
        throw new Error(await relationResponse.text());
      }

      return relationResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/family"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsAddingRelation(false);
      setIsCreatingUser(false);
      form.reset();
      toast({
        title: "Success",
        description: "New family member added successfully",
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

  const handleAddRelation = () => {
    if (isCreatingUser) {
      form.handleSubmit((data) => {
        createUserAndRelationMutation.mutate(data);
      })();
      return;
    }

    if (!selectedRelativeMemberId) {
      toast({
        title: "Error",
        description: "Please select a family member",
        variant: "destructive",
      });
      return;
    }

    if (!relationType) {
      toast({
        title: "Error",
        description: "Please select a relation type",
        variant: "destructive",
      });
      return;
    }

    const memberId = parseInt(selectedRelativeMemberId);
    if (isNaN(memberId)) {
      toast({
        title: "Error",
        description: "Invalid family member selected",
        variant: "destructive",
      });
      return;
    }

    addRelationMutation.mutate({
      toUserId: memberId,
      relationType,
    });
  };

  const getParentOfParent = (parentId: number): FamilyMember | undefined => {
    const parentRelations = relations.filter(r =>
      (r.fromUserId === parentId && r.relationType === 'child') ||
      (r.toUserId === parentId && r.relationType === 'parent')
    );

    for (const relation of parentRelations) {
      const potentialGrandparent = relation.fromUserId === parentId ? relation.toUser : relation.fromUser;
      // Skip if this is the current user
      if (potentialGrandparent.id === currentUserId) continue;
      return potentialGrandparent;
    }
    return undefined;
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (event.button !== 0) return;
    setIsDragging(true);
    setDragStart({
      x: event.clientX - position.x,
      y: event.clientY - position.y
    });
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = event.clientX - dragStart.x;
    const newY = event.clientY - dragStart.y;
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length === 1) {
      event.preventDefault();
      setTouchStart({
        x: event.touches[0].clientX - position.x,
        y: event.touches[0].clientY - position.y
      });
    } else if (event.touches.length === 2) {
      // Handle pinch start
      const distance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );
      setLastPinchDistance(distance);
    }
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.touches.length === 1) {
      // Handle pan
      const touch = event.touches[0];
      const newX = touch.clientX - touchStart.x;
      const newY = touch.clientY - touchStart.y;

      // Apply the new position
      setPosition({ x: newX, y: newY });
    } else if (event.touches.length === 2 && lastPinchDistance !== null) {
      // Handle pinch zoom
      const distance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );
      const delta = distance - lastPinchDistance;
      setLastPinchDistance(distance);

      // Adjust scale with constraints
      const newScale = Math.max(0.5, Math.min(2, scale + delta * 0.01));
      setScale(newScale);
    }
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    event.preventDefault();
    setLastPinchDistance(null);
  };

  const handleNodeClick = (event: React.MouseEvent, userId: number | undefined) => {
    if (!userId) return;

    event.stopPropagation();
    event.preventDefault();
    if (!isDragging && onUserClick) {
      onUserClick(userId);
    } else if (!isDragging) {
      navigate(`/profile/${userId}`);
    }
  };

  if (!currentUserId || !displayUser) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-[400px] w-full bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Family Tree</CardTitle>
            <CardDescription>
              {isOwnTree ? "Your family connections" : `${displayUser.displayName || displayUser.username}'s family connections`}
            </CardDescription>
          </div>
          {isOwnTree && (
            <Button onClick={() => setIsAddingRelation(true)}>
              Add Relation
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="relative w-full overflow-hidden border rounded-lg touch-pan-x touch-pan-y"
            style={{
              height: '600px',
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              WebkitOverflowScrolling: 'touch' // Enable momentum scrolling on iOS
            }}
          >
            {/* SVG Family Tree */}
            <svg
              width={SVG_WIDTH}
              height={SVG_HEIGHT}
              className="max-w-full cursor-move touch-none select-none"
              ref={svgRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <g transform={`translate(${position.x},${position.y}) scale(${scale})`}>
                {/* Render parents and their parents (grandparents) */}
                {familyGroups.parent?.map((parent, i) => {
                  const parentOfParent = getParentOfParent(parent.id);
                  const x = CENTER_X - (familyGroups.parent.length - 1) * 100 + i * 200;
                  const y = CENTER_Y - 150;

                  return (
                    <g key={`parent-group-${parent.id}`}>
                      {/* Render grandparent if exists */}
                      {parentOfParent && (
                        <g key={`grandparent-group-${parentOfParent.id}`}>
                          <g
                            transform={`translate(${x},${y - 150})`}
                            onClick={(e) => handleNodeClick(e, parentOfParent.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <circle
                              r={40}
                              fill="hsl(var(--secondary))"
                              className="stroke-2 stroke-white"
                            />
                            <text
                              textAnchor="middle"
                              dy=".3em"
                              fill="hsl(var(--secondary-foreground))"
                              className="text-sm font-medium"
                              pointerEvents="none"
                            >
                              {parentOfParent.displayName || parentOfParent.username}
                            </text>
                          </g>
                          <line
                            x1={x}
                            y1={y - 110}
                            x2={x}
                            y2={y - 40}
                            stroke="hsl(var(--border))"
                            strokeWidth="2"
                            pointerEvents="none"
                          />
                        </g>
                      )}

                      {/* Render parent */}
                      <g
                        transform={`translate(${x},${y})`}
                        onClick={(e) => handleNodeClick(e, parent.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle
                          r={40}
                          fill="hsl(var(--secondary))"
                          className="stroke-2 stroke-white"
                        />
                        <text
                          textAnchor="middle"
                          dy=".3em"
                          fill="hsl(var(--secondary-foreground))"
                          className="text-sm font-medium"
                          pointerEvents="none"
                        >
                          {parent.displayName || parent.username}
                        </text>
                      </g>
                      <line
                        x1={x}
                        y1={y + 40}
                        x2={CENTER_X}
                        y2={CENTER_Y - 40}
                        stroke="hsl(var(--border))"
                        strokeWidth="2"
                        pointerEvents="none"
                      />
                    </g>
                  );
                })}

                {/* Render children */}
                {familyGroups.child?.map((child, i) => {
                  const x = CENTER_X - (familyGroups.child.length - 1) * 100 + i * 200;
                  const y = CENTER_Y + 150;

                  return (
                    <g key={`child-group-${child.id}`}>
                      <g
                        transform={`translate(${x},${y})`}
                        onClick={(e) => handleNodeClick(e, child.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle
                          r={40}
                          fill="hsl(var(--secondary))"
                          className="stroke-2 stroke-white"
                        />
                        <text
                          textAnchor="middle"
                          dy=".3em"
                          fill="hsl(var(--secondary-foreground))"
                          className="text-sm font-medium"
                          pointerEvents="none"
                        >
                          {child.displayName || child.username}
                        </text>
                      </g>
                      <line
                        x1={CENTER_X}
                        y1={CENTER_Y + 40}
                        x2={x}
                        y2={y - 40}
                        stroke="hsl(var(--border))"
                        strokeWidth="2"
                        pointerEvents="none"
                      />
                    </g>
                  );
                })}

                {/* Render spouse */}
                {familyGroups.spouse?.map((spouse, i) => {
                  const x = CENTER_X - 200;
                  const y = CENTER_Y;

                  return (
                    <g key={`spouse-group-${spouse.id}`}>
                      <g
                        transform={`translate(${x},${y})`}
                        onClick={(e) => handleNodeClick(e, spouse.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle
                          r={40}
                          fill="hsl(var(--secondary))"
                          className="stroke-2 stroke-white"
                        />
                        <text
                          textAnchor="middle"
                          dy=".3em"
                          fill="hsl(var(--secondary-foreground))"
                          className="text-sm font-medium"
                          pointerEvents="none"
                        >
                          {spouse.displayName || spouse.username}
                        </text>
                      </g>
                      <line
                        x1={x + 40}
                        y1={y}
                        x2={CENTER_X - 40}
                        y2={CENTER_Y}
                        stroke="hsl(var(--border))"
                        strokeWidth="2"
                        pointerEvents="none"
                      />
                      <text
                        x={(x + CENTER_X) / 2}
                        y={y - 10}
                        textAnchor="middle"
                        fill="hsl(var(--muted-foreground))"
                        className="text-xs"
                        pointerEvents="none"
                      >
                        Spouse
                      </text>
                    </g>
                  );
                })}

                {/* Render siblings */}
                {familyGroups.sibling?.map((sibling, i) => {
                  const siblingStartX = CENTER_X + 200;
                  const x = siblingStartX + (i * 200);
                  const y = CENTER_Y;

                  return (
                    <g key={`sibling-group-${sibling.id}`}>
                      <g
                        transform={`translate(${x},${y})`}
                        onClick={(e) => handleNodeClick(e, sibling.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle
                          r={40}
                          fill="hsl(var(--secondary))"
                          className="stroke-2 stroke-white"
                        />
                        <text
                          textAnchor="middle"
                          dy=".3em"
                          fill="hsl(var(--secondary-foreground))"
                          className="text-sm font-medium"
                          pointerEvents="none"
                        >
                          {sibling.displayName || sibling.username}
                        </text>
                      </g>
                      <line
                        x1={i === 0 ? CENTER_X + 40 : siblingStartX + ((i - 1) * 200) + 40}
                        y1={CENTER_Y}
                        x2={x - 40}
                        y2={y}
                        stroke="hsl(var(--border))"
                        strokeWidth="2"
                        pointerEvents="none"
                      />
                      <text
                        x={(x + (i === 0 ? CENTER_X : siblingStartX + ((i - 1) * 200))) / 2}
                        y={y - 10}
                        textAnchor="middle"
                        fill="hsl(var(--muted-foreground))"
                        className="text-xs"
                        pointerEvents="none"
                      >
                        Sibling
                      </text>
                    </g>
                  );
                })}

                {/* Center user node */}
                <g
                  key={`center-user-${displayUser?.id}`}
                  transform={`translate(${CENTER_X},${CENTER_Y})`}
                  onClick={(e) => handleNodeClick(e, displayUser?.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    r={40}
                    fill="hsl(var(--primary))"
                    className="stroke-2 stroke-white"
                  />
                  <text
                    textAnchor="middle"
                    dy=".3em"
                    fill="white"
                    className="text-sm font-medium"
                    pointerEvents="none"
                  >
                    {displayUser?.displayName || displayUser?.username}
                  </text>
                </g>
              </g>
            </svg>
          </div>

          {/* Add Relation Dialog */}
          {isOwnTree && isAddingRelation && (
            <Dialog open={isAddingRelation} onOpenChange={setIsAddingRelation}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Family Relation</DialogTitle>
                </DialogHeader>

                {isCreatingUser ? (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleAddRelation)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="displayName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Display Name</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email (Optional)</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="birthday"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Date of birth</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP")
                                    ) : (
                                      <span>Pick a date</span>
                                    )}
                                    <Trash2 className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) =>
                                    date > new Date() || date < new Date("1900-01-01")
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="relationType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Relation Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a relation type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="parent">Parent</SelectItem>
                                <SelectItem value="child">Child</SelectItem>
                                <SelectItem value="sibling">Sibling</SelectItem>
                                <SelectItem value="spouse">Spouse</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreatingUser(false)}
                        >
                          Back
                        </Button>
                        <Button type="submit">Add Member</Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <div className="space-y-4">
                    <Select onValueChange={setSelectedRelativeMemberId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a family member" />
                      </SelectTrigger>
                      <SelectContent>
                        {allUsers
                          .filter((u) => u.id !== user?.id)
                          .map((member) => (
                            <SelectItem key={member.id} value={member.id.toString()}>
                              {member.displayName || member.username}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>

                    <Select onValueChange={setRelationType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a relation type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parent">Parent</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="sibling">Sibling</SelectItem>
                        <SelectItem value="spouse">Spouse</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsCreatingUser(true)}>
                        Create New
                      </Button>
                      <Button onClick={handleAddRelation}>Add Relation</Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default FamilyTree;