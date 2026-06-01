import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  areTeamMembersEqual,
  createTeamMember,
  isProfileLinkedTeamMemberId,
  mergeCurrentUserIntoMembers,
  membersToAssignees,
  teamMemberToAssignee,
  updateTeamMember,
} from "../data/teamData";
import { loadTeamMembers, saveTeamMembers } from "../lib/teamStorage";
import { archiveDeletedItem } from "../lib/deletedItemsStorage";
import { logWorkspaceActivity } from "../lib/workspaceActivityLog";
import { useRoadmapAuth } from "./RoadmapAuthContext";

const TeamContext = createContext(null);

export function TeamProvider({ children }) {
  const { profile, isAdmin } = useRoadmapAuth();
  const [members, setMembers] = useState(() => loadTeamMembers());
  const lastSavedMembersRef = useRef(null);

  useEffect(() => {
    if (!profile) return;
    setMembers((prev) => mergeCurrentUserIntoMembers(prev, profile));
  }, [profile?.id, profile?.username, profile?.fullName, profile?.role, profile?.workspaceName, profile?.profilePicture]);

  useEffect(() => {
    if (areTeamMembersEqual(lastSavedMembersRef.current, members)) return;
    lastSavedMembersRef.current = members;
    saveTeamMembers(members);
  }, [members]);

  const addMember = useCallback(
    (fields) => {
      if (!profile) return null;

      const requestedId = fields.id?.trim();
      if (requestedId && isProfileLinkedTeamMemberId(requestedId) && !isAdmin) {
        return null;
      }

      let created = null;
      setMembers((prev) => {
        if (requestedId && prev.some((member) => member.id === requestedId)) {
          return prev;
        }
        created = createTeamMember(fields, prev);
        return [...prev, created];
      });
      if (created) {
        logWorkspaceActivity({
          type: "team_member_added",
          message: created.name || created.email || "Team member",
          meta: created.role || "",
        });
      }
      return created;
    },
    [profile, isAdmin]
  );

  const updateMember = useCallback(
    (memberId, fields) => {
      if (!profile) return null;

      let updated = null;
      setMembers((prev) => {
        const index = prev.findIndex((member) => member.id === memberId);
        if (index === -1) return prev;

        updated = updateTeamMember(prev[index], fields);
        const next = [...prev];
        next[index] = updated;
        return next;
      });
      if (updated) {
        logWorkspaceActivity({
          type: "team_member_edited",
          message: updated.name || updated.email || "Team member",
          meta: updated.role || "",
        });
      }
      return updated;
    },
    [profile]
  );

  const deleteMember = useCallback(
    (memberId) => {
      if (!profile) return false;

      let deleted = null;
      let removed = false;

      setMembers((prev) => {
        const member = prev.find((item) => item.id === memberId);
        if (!member || member.isCurrentUser) return prev;
        deleted = member;
        removed = true;
        return prev.filter((item) => item.id !== memberId);
      });

      if (deleted) {
        archiveDeletedItem("member", deleted);
        logWorkspaceActivity({
          type: "team_member_deleted",
          message: deleted.name || deleted.email || "Team member",
          meta: deleted.role || "",
        });
      }

      return removed;
    },
    [profile]
  );

  const restoreMember = useCallback(
    (snapshot) => {
      if (!profile || !snapshot?.id || snapshot.isCurrentUser) return false;

      let restored = false;
      setMembers((prev) => {
        if (prev.some((item) => item.id === snapshot.id)) return prev;
        restored = true;
        return [...prev, snapshot];
      });
      return restored;
    },
    [profile]
  );

  const currentUserMember = useMemo(
    () => members.find((member) => member.isCurrentUser) ?? null,
    [members]
  );

  const currentUserMemberId = currentUserMember?.id ?? null;
  const currentUserAssignee = useMemo(
    () => (currentUserMember ? teamMemberToAssignee(currentUserMember) : null),
    [currentUserMember]
  );

  const assignees = useMemo(() => membersToAssignees(members), [members]);

  const value = useMemo(
    () => ({
      members,
      assignees,
      addMember,
      updateMember,
      deleteMember,
      restoreMember,
      canAddMembers: Boolean(profile),
      canLinkProfileMembers: isAdmin,
      currentUserMember,
      currentUserMemberId,
      currentUserAssignee,
    }),
    [members, assignees, addMember, updateMember, deleteMember, restoreMember, profile, isAdmin, currentUserMember, currentUserMemberId, currentUserAssignee]
  );

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) {
    throw new Error("useTeam must be used within TeamProvider");
  }
  return ctx;
}
