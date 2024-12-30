import { useQuery } from "@tanstack/react-query";
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
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "../hooks/use-user";
import { useState } from "react";

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
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);

  const { data: relations = [], isLoading } = useQuery<FamilyRelation[]>({
    queryKey: ["/api/family"],
    enabled: !!user,
  });

  if (!user) {
    return null; // Let the parent handle the unauthorized state
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
        <CardHeader>
          <CardTitle>Family Tree</CardTitle>
          <CardDescription>
            Visualizing your family connections
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {renderTreeSvg()}
        </CardContent>
      </Card>

      <Dialog
        open={selectedMember !== null}
        onOpenChange={(open) => !open && setSelectedMember(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedMember?.displayName || selectedMember?.username}</DialogTitle>
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
                    <li key={relation.id}>
                      {relation.fromUserId === selectedMember?.id
                        ? `${relation.relationType} of ${relation.toUser.displayName || relation.toUser.username}`
                        : `${relation.fromUser.displayName || relation.fromUser.username}'s ${relation.relationType}`}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}