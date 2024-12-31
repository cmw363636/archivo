import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "../hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

type FamilyMember = {
  id: number;
  username: string;
  displayName: string;
};

type FamilyRelation = {
  id: number;
  fromUserId: number;
  toUserId: number;
  relationType: string;
  fromUser: FamilyMember;
  toUser: FamilyMember;
};

export default function FamilyTree() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [isAddingRelation, setIsAddingRelation] = useState(false);
  const [selectedRelativeMemberId, setSelectedRelativeMemberId] = useState<string>("");
  const [relationType, setRelationType] = useState<string>("");

  const { data: relations = [], isLoading } = useQuery<FamilyRelation[]>({
    queryKey: ["/api/family"],
    enabled: !!user,
  });

  const { data: allUsers = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/users"],
    enabled: !!user,
  });

  const addRelationMutation = useMutation({
    mutationFn: async (data: { toUserId: number; relationType: string }) => {
      const response = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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
      // Error handling is done in the mutation
    }
  };

  const handleAddRelation = () => {
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

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const familyMembers = relations.reduce((acc, relation) => {
    const fromUser = relation.fromUser;
    const toUser = relation.toUser;
    if (!acc.some((m) => m.id === fromUser.id)) {
      acc.push(fromUser);
    }
    if (!acc.some((m) => m.id === toUser.id)) {
      acc.push(toUser);
    }
    return acc;
  }, [] as FamilyMember[]);

  // Calculate tree layout
  const treeWidth = 1000;
  const treeHeight = 600;
  const nodeRadius = 40;

  const renderTreeSvg = () => {
    const centerX = treeWidth / 2;
    const centerY = treeHeight / 2;

    // Position current user at center
    const userNode = (
      <g key={user.id} transform={`translate(${centerX},${centerY})`}>
        <circle
          r={nodeRadius}
          fill="hsl(var(--primary))"
          className="stroke-2 stroke-white"
        />
        <text
          textAnchor="middle"
          dy=".3em"
          fill="white"
          className="text-sm font-medium"
        >
          {user.displayName || user.username}
        </text>
      </g>
    );

    // Position family members in a circle around the user
    const memberNodes = familyMembers
      .filter((m) => m.id !== user.id)
      .map((member, i, arr) => {
        const angle = (i * 2 * Math.PI) / (arr.length || 1);
        const x = centerX + Math.cos(angle) * 200;
        const y = centerY + Math.sin(angle) * 200;

        return (
          <g
            key={member.id}
            transform={`translate(${x},${y})`}
            className="cursor-pointer"
            onClick={() => setSelectedMember(member)}
          >
            <circle
              r={nodeRadius}
              fill="hsl(var(--secondary))"
              className="stroke-2 stroke-white"
            />
            <text
              textAnchor="middle"
              dy=".3em"
              fill="hsl(var(--secondary-foreground))"
              className="text-sm font-medium"
            >
              {member.displayName || member.username}
            </text>
          </g>
        );
      });

    // Draw relations
    const relationLines = relations.map((relation) => {
      const fromNode = familyMembers.find((m) => m.id === relation.fromUserId);
      const toNode = familyMembers.find((m) => m.id === relation.toUserId);

      if (!fromNode || !toNode) return null;

      // Calculate positions based on the same logic as above
      const fromIndex = familyMembers.findIndex((m) => m.id === fromNode.id);
      const toIndex = familyMembers.findIndex((m) => m.id === toNode.id);
      const fromAngle = fromNode.id === user.id
        ? 0
        : ((fromIndex - 1) * 2 * Math.PI) / (familyMembers.length - 1);
      const toAngle = toNode.id === user.id
        ? 0
        : ((toIndex - 1) * 2 * Math.PI) / (familyMembers.length - 1);

      const fromX = fromNode.id === user.id
        ? centerX
        : centerX + Math.cos(fromAngle) * 200;
      const fromY = fromNode.id === user.id
        ? centerY
        : centerY + Math.sin(fromAngle) * 200;
      const toX = toNode.id === user.id
        ? centerX
        : centerX + Math.cos(toAngle) * 200;
      const toY = toNode.id === user.id
        ? centerY
        : centerY + Math.sin(toAngle) * 200;

      return (
        <line
          key={relation.id}
          x1={fromX}
          y1={fromY}
          x2={toX}
          y2={toY}
          stroke="hsl(var(--border))"
          strokeWidth="2"
          markerEnd="url(#arrowhead)"
        />
      );
    });

    return (
      <svg width={treeWidth} height={treeHeight} className="max-w-full">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="hsl(var(--border))"
            />
          </marker>
        </defs>
        {relationLines}
        {memberNodes}
        {userNode}
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Family Tree</CardTitle>
            <CardDescription>
              Visualizing your family connections
            </CardDescription>
          </div>
          <Button onClick={() => setIsAddingRelation(true)}>
            Add Relation
          </Button>
        </CardHeader>
        <CardContent className="flex justify-center">
          {renderTreeSvg()}
        </CardContent>
      </Card>

      {/* Member Details Dialog */}
      <Dialog
        open={selectedMember !== null}
        onOpenChange={(open) => !open && setSelectedMember(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedMember?.displayName || selectedMember?.username}</DialogTitle>
            <DialogDescription>Family relations for this member</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">Relations:</h3>
              <ul className="mt-2 space-y-2">
                {relations
                  .filter(
                    (r) =>
                      r.fromUserId === selectedMember?.id ||
                      r.toUserId === selectedMember?.id
                  )
                  .map((relation) => (
                    <li key={relation.id} className="text-sm flex items-center justify-between">
                      <span>
                        {relation.fromUserId === selectedMember?.id
                          ? `${relation.relationType} of ${relation.toUser.displayName || relation.toUser.username}`
                          : `${relation.fromUser.displayName || relation.fromUser.username}'s ${relation.relationType}`}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRelation(relation.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Relation Dialog */}
      <Dialog
        open={isAddingRelation}
        onOpenChange={(open) => {
          setIsAddingRelation(open);
          if (!open) {
            setSelectedRelativeMemberId("");
            setRelationType("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Family Relation</DialogTitle>
            <DialogDescription>
              Select a family member and specify their relation to you
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Member</label>
              <Select
                value={selectedRelativeMemberId}
                onValueChange={setSelectedRelativeMemberId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a family member" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter((u) => u.id !== user.id)
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.displayName || user.username}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Relation Type</label>
              <Select
                value={relationType}
                onValueChange={setRelationType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select relation type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="child">Child</SelectItem>
                  <SelectItem value="sibling">Sibling</SelectItem>
                  <SelectItem value="spouse">Spouse</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              disabled={!selectedRelativeMemberId || !relationType}
              onClick={handleAddRelation}
            >
              Add Relation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}