import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator
} from "react-native";
import * as Haptics from "expo-haptics";
import { TownsBA6Theme as T } from "../ui/towns/theme";
import { ScreenHeader } from "../ui/towns/ScreenHeader";
import { useAppState } from "../state/AppState";
import { Group, createGroup, getGroupById, getGroups, joinGroupByCode } from "../lib/groupsApi";

export function GroupsHome({ navigation }: any) {
  const { hasSession } = useAppState();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalMode, setModalMode] = useState<"create" | "join" | null>(null);
  const [modalValue, setModalValue] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    if (!hasSession) return;
    setLoading(true);
    const res = await getGroups();
    if (res.error) setError(res.error);
    else {
      setError(null);
      setGroups(res.data);
    }
    setLoading(false);
  }, [hasSession]);

  useEffect(() => {
    loadGroups().catch(() => {});
  }, [loadGroups]);

  const openModal = (mode: "create" | "join") => {
    setModalMode(mode);
    setModalValue("");
    setModalError(null);
  };

  const closeModal = () => {
    setModalMode(null);
    setModalValue("");
    setModalError(null);
  };

  const handleModalSubmit = async () => {
    if (!modalMode) return;
    const value = modalValue.trim();
    if (!value) {
      setModalError(modalMode === "create" ? "Enter a group name." : "Enter an invite code.");
      return;
    }

    setModalLoading(true);
    setModalError(null);
    try {
      await Haptics.selectionAsync();
      if (modalMode === "create") {
        const group = await createGroup(value);
        await loadGroups();
        closeModal();
        navigation.navigate("GroupChat", {
          groupId: group.id,
          groupName: group.name,
          inviteCode: group.invite_code
        });
      } else {
        const groupId = await joinGroupByCode(value.toUpperCase());
        const groupRes = await getGroupById(groupId);
        await loadGroups();
        const joined = groupRes.data;
        closeModal();
        navigation.navigate("GroupChat", {
          groupId,
          groupName: joined?.name
        });
      }
    } catch (err: any) {
      setModalError(err?.message ?? "Something went wrong.");
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.colors.bg }}>
      <ScreenHeader
        title="Groups"
        subtitle="Your shared rooms for real-time chat."
        onPressAction={() => navigation.navigate("Settings")}
        actionLabel="Tools"
      />

      <View style={{ paddingHorizontal: T.space.s16, paddingTop: T.space.s16 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => openModal("create")}
            style={{
              flex: 1,
              paddingVertical: T.space.s10,
              borderRadius: T.radii.pill,
              backgroundColor: T.colors.blue1,
              alignItems: "center"
            }}
          >
            <Text style={{ color: "white", fontWeight: "800" }}>New Group</Text>
          </Pressable>
          <Pressable
            onPress={() => openModal("join")}
            style={{
              flex: 1,
              paddingVertical: T.space.s10,
              borderRadius: T.radii.pill,
              backgroundColor: T.colors.layer2,
              alignItems: "center"
            }}
          >
            <Text style={{ color: T.colors.text, fontWeight: "800" }}>Join Group</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: T.space.s16 }}>
        {loading ? (
          <View style={{ paddingTop: T.space.s16 }}>
            <ActivityIndicator color={T.colors.blue1} />
          </View>
        ) : null}

        {error ? (
          <View style={{ marginTop: T.space.s12 }}>
            <Text style={{ color: "#E14B4B", fontWeight: "700" }}>{error}</Text>
          </View>
        ) : null}

        {!loading && !groups.length ? (
          <View style={{ marginTop: T.space.s20 }}>
            <Text style={{ color: T.colors.textMuted, fontWeight: "700" }}>No groups yet.</Text>
            <Text style={{ marginTop: 6, color: T.colors.textMuted }}>
              Create a group or join with an invite code.
            </Text>
          </View>
        ) : null}

        {groups.map((group) => (
          <Pressable
            key={group.id}
            onPress={() =>
              navigation.navigate("GroupChat", {
                groupId: group.id,
                groupName: group.name,
                inviteCode: group.invite_code
              })
            }
            style={{
              marginTop: T.space.s12,
              padding: T.space.s14,
              borderRadius: T.radii.card,
              backgroundColor: T.colors.layer1,
              shadowColor: T.colors.shadow,
              shadowOpacity: 0.12,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 3 },
              elevation: 1
            }}
          >
            <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 16 }} numberOfLines={1}>
              {group.name}
            </Text>
            {group.description ? (
              <Text style={{ marginTop: 6, color: T.colors.textMuted }} numberOfLines={2}>
                {group.description}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>

      <Modal transparent visible={modalMode !== null} animationType="fade" onRequestClose={closeModal}>
        <Pressable
          onPress={closeModal}
          style={{
            flex: 1,
            backgroundColor: "rgba(11,15,22,0.35)",
            justifyContent: "center",
            padding: T.space.s16
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: T.colors.layer1,
              borderRadius: T.radii.card,
              padding: T.space.s16
            }}
          >
            <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 16 }}>
              {modalMode === "create" ? "Create group" : "Join group"}
            </Text>
            <Text style={{ marginTop: 6, color: T.colors.textMuted }}>
              {modalMode === "create" ? "Name your new group." : "Enter the invite code."}
            </Text>

            <TextInput
              value={modalValue}
              onChangeText={setModalValue}
              placeholder={modalMode === "create" ? "Group name" : "Invite code"}
              placeholderTextColor={T.colors.textMuted}
              autoCapitalize={modalMode === "create" ? "sentences" : "characters"}
              style={{
                marginTop: T.space.s12,
                height: 48,
                borderRadius: T.radii.input,
                paddingHorizontal: 14,
                backgroundColor: T.colors.layer2,
                color: T.colors.text,
                fontWeight: "600"
              }}
            />

            {modalError ? (
              <Text style={{ marginTop: T.space.s8, color: "#E14B4B", fontWeight: "700" }}>
                {modalError}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: 10, marginTop: T.space.s12 }}>
              <Pressable
                onPress={closeModal}
                disabled={modalLoading}
                style={{
                  flex: 1,
                  paddingVertical: T.space.s10,
                  borderRadius: T.radii.pill,
                  backgroundColor: T.colors.layer2,
                  alignItems: "center",
                  opacity: modalLoading ? 0.6 : 1
                }}
              >
                <Text style={{ color: T.colors.text, fontWeight: "800" }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleModalSubmit}
                disabled={modalLoading}
                style={{
                  flex: 1,
                  paddingVertical: T.space.s10,
                  borderRadius: T.radii.pill,
                  backgroundColor: T.colors.blue1,
                  alignItems: "center",
                  opacity: modalLoading ? 0.6 : 1
                }}
              >
                {modalLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ color: "white", fontWeight: "800" }}>
                    {modalMode === "create" ? "Create" : "Join"}
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
