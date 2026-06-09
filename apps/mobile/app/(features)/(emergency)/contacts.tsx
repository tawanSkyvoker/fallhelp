/**
 * Emergency Contacts Screen
 *
 * หน้านี้ใช้จัดการรายชื่อผู้ติดต่อฉุกเฉิน
 *
 * สิ่งที่เกิดขึ้นในหน้านี้:
 * - โหลดข้อมูลผู้สูงอายุปัจจุบัน
 * - โหลดรายชื่อผู้ติดต่อฉุกเฉิน
 * - เพิ่มผู้ติดต่อใหม่ได้สูงสุด 5 เบอร์
 * - แก้ไขหรือลบผู้ติดต่อได้
 * - ลากจัดลำดับผู้ติดต่อ เพื่อกำหนด priority
 * - รายชื่อ 3 อันดับแรกจะถูกใช้ในหน้าโทรฉุกเฉิน
 */

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  useWindowDimensions,
  Vibration,
  InteractionManager,
} from 'react-native';
import { MaterialSymbol } from '../../../components/MaterialSymbol';
import { MaterialIconSolid } from '../../../components/MaterialIconSolid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';

import KanitText from '../../../components/KanitText';
import { ListItemSkeleton } from '../../../components/skeletons';
import { ScreenWrapper } from '../../../components/ScreenWrapper';
import { AppScreenHeader as ScreenHeader } from '../../../components/AppScreenHeader';
import { LoadingScreen } from '../../../components/LoadingScreen';

import {
  listContacts,
  deleteContact,
  reorderContacts,
} from '../../../services/emergencyContactService';
import { safeRouter as router } from '../../../utils/safeRouter';
import { showDialog } from '../../../utils/dialogService';
import { showSuccessToast } from '../../../utils/toast';
import Logger from '../../../utils/logger';
import { showErrorMessage } from '../../../utils/errorHelper';

import { useCurrentElder } from '../../../hooks/useCurrentElder';
import { queryKeys } from '../../../hooks/queryKeys';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { EmergencyContact } from '../../../services/types';

const MAX_CONTACTS = 5;
const CONTACT_CARD_MIN_HEIGHT = 96;

function getSafePriority(contact: EmergencyContact, fallbackPriority: number): number {
  return typeof contact.priority === 'number' && Number.isFinite(contact.priority)
    ? contact.priority
    : fallbackPriority;
}

function normalizeContactsPriority(contacts: EmergencyContact[]): EmergencyContact[] {
  return contacts.map((contact, index) => {
    const nextPriority = index + 1;

    if (contact.priority === nextPriority) {
      return contact;
    }

    return {
      ...contact,
      priority: nextPriority,
    };
  });
}

function sortContactsByPriority(contacts: EmergencyContact[]): EmergencyContact[] {
  const sortedContacts = contacts
    .map((contact, index) => ({ contact, index }))
    .sort((a, b) => {
      const priorityA = getSafePriority(a.contact, a.index + 1);
      const priorityB = getSafePriority(b.contact, b.index + 1);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return a.index - b.index;
    })
    .map(({ contact }) => contact);

  return normalizeContactsPriority(sortedContacts);
}

function orderContactsByIds(
  contacts: EmergencyContact[],
  orderedContactIds: string[],
): EmergencyContact[] {
  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
  const orderedIdSet = new Set(orderedContactIds);

  const orderedContacts = orderedContactIds.flatMap((contactId) => {
    const contact = contactsById.get(contactId);
    return contact ? [contact] : [];
  });

  const leftoverContacts = sortContactsByPriority(
    contacts.filter((contact) => !orderedIdSet.has(contact.id)),
  );

  return normalizeContactsPriority([...orderedContacts, ...leftoverContacts]);
}

function hasSameContactOrder(
  currentContacts: EmergencyContact[],
  nextContacts: EmergencyContact[],
): boolean {
  if (currentContacts.length !== nextContacts.length) {
    return false;
  }

  return currentContacts.every((contact, index) => {
    const next = nextContacts[index];
    if (!next) return false;

    return (
      contact.id === next.id &&
      contact.name === next.name &&
      contact.phone === next.phone &&
      contact.relationship === next.relationship &&
      contact.priority === next.priority
    );
  });
}

interface ContactMetaProps {
  item: EmergencyContact;
  isActive: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}

const ContactMeta = React.memo(function ContactMeta({
  item,
  isActive,
  onEdit,
  onDelete,
}: ContactMetaProps) {
  return (
    <>
      <View className="flex-1 flex-shrink justify-center py-1">
        <KanitText className="text-lg text-gray-900 font-medium leading-6" numberOfLines={1}>
          {item.name}
        </KanitText>

        <KanitText className="text-[15px] text-gray-500 mt-0.5" numberOfLines={1}>
          {item.phone}
        </KanitText>

        <KanitText className="text-[13px] text-gray-400 mt-0.5" numberOfLines={1}>
          {item.relationship || 'ไม่ระบุ'}
        </KanitText>
      </View>

      <View className="flex-row items-center ml-2" pointerEvents={isActive ? 'none' : 'auto'}>
        <TouchableOpacity
          disabled={isActive}
          onPress={() => onEdit(item.id)}
          className="p-2.5 bg-blue-50 rounded-xl mr-2"
        >
          <MaterialIconSolid name="edit" size={22} color="#3B82F6" />
        </TouchableOpacity>

        <TouchableOpacity
          disabled={isActive}
          onPress={() => onDelete(item.id, item.name)}
          className="p-2.5 bg-red-50 rounded-xl"
        >
          <MaterialIconSolid name="delete" size={22} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </>
  );
});

ContactMeta.displayName = 'ContactMeta';

interface ContactItemProps {
  item: EmergencyContact;
  drag: () => void;
  isActive: boolean;
  displayIndex: number;
  isReorderable: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}

const ContactItem = React.memo(function ContactItem({
  item,
  drag,
  isActive,
  displayIndex,
  isReorderable,
  onEdit,
  onDelete,
}: ContactItemProps) {
  return (
    <View
      testID="emergency-contact-card-shell"
      collapsable={false}
      style={[
        {
          minHeight: CONTACT_CARD_MIN_HEIGHT,
          backgroundColor: '#FFFFFF',
        },
        Platform.OS === 'android'
          ? { elevation: 1 }
          : {
              shadowColor: '#000',
              shadowOpacity: 0.06,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
            },
      ]}
      className="rounded-3xl py-3 px-4 mb-2 border border-gray-100 flex-row items-center"
    >
      {isReorderable ? (
        <TouchableOpacity
          onLongPress={drag}
          onPressIn={() => {
            if (!isActive) {
              Vibration.vibrate(15);
            }
          }}
          delayLongPress={120}
          disabled={isActive}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="flex-row items-center mr-2 -m-2 p-2"
          activeOpacity={0.6}
        >
          <View className="p-2 -m-2 mr-3">
            <MaterialSymbol name="drag_handle" size={28} color="#9CA3AF" />
          </View>

          <View className="w-11 h-11 rounded-full flex-row items-center justify-center bg-[#FFF5F5] border border-[#FFEAEA]">
            <KanitText className="text-lg text-[#EF4444] font-medium">{displayIndex + 1}</KanitText>
          </View>
        </TouchableOpacity>
      ) : (
        <View className="w-11 h-11 rounded-full flex-row items-center justify-center mr-3 bg-[#FFF5F5] border border-[#FFEAEA]">
          <KanitText className="text-lg text-[#EF4444] font-medium">{displayIndex + 1}</KanitText>
        </View>
      )}

      <ContactMeta item={item} isActive={isActive} onEdit={onEdit} onDelete={onDelete} />
    </View>
  );
});

ContactItem.displayName = 'ContactItem';

export default function EmergencyContactsScreen() {
  const queryClient = useQueryClient();

  const [localContacts, setLocalContacts] = useState<EmergencyContact[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const isDraggingRef = useRef(false);

  const { bottom } = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const screenHeight = Dimensions.get('screen').height;
  const statusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  const androidNavBarHeight =
    Platform.OS === 'android' ? Math.max(0, screenHeight - windowHeight - statusBarHeight) : 0;
  const navBarInset = bottom > 0 ? bottom : androidNavBarHeight;

  const { data: currentElder, isLoading: isElderLoading } = useCurrentElder();
  const elderId = currentElder?.id;

  const cachedContacts = useMemo(() => {
    if (!elderId) {
      return undefined;
    }

    const contactsFromCache = queryClient.getQueryData<EmergencyContact[]>(
      queryKeys.emergencyContacts(elderId),
    );

    return contactsFromCache ? sortContactsByPriority(contactsFromCache) : undefined;
  }, [elderId, queryClient]);

  const {
    data: contacts,
    isLoading,
    refetch,
  } = useQuery<EmergencyContact[]>({
    queryKey: queryKeys.emergencyContacts(elderId),
    enabled: !!elderId,
    queryFn: async () => {
      if (!elderId) {
        return [];
      }

      const contactList = await listContacts(elderId);

      if (Array.isArray(contactList)) {
        return sortContactsByPriority(contactList);
      }

      return [];
    },
    ...(cachedContacts !== undefined ? { placeholderData: cachedContacts } : {}),
  });

  useFocusEffect(
    React.useCallback(() => {
      setIsNavigating(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.currentElder() });
      refetch();
    }, [refetch, queryClient]),
  );

  const deleteMutation = useMutation({
    mutationFn: (contactId: string) => {
      if (!elderId) {
        throw new Error('ไม่พบข้อมูลผู้สูงอายุ');
      }

      return deleteContact(elderId, contactId);
    },
    onSuccess: (_, contactId) => {
      if (elderId) {
        queryClient.setQueryData<EmergencyContact[]>(
          queryKeys.emergencyContacts(elderId),
          (oldContacts) =>
            normalizeContactsPriority(
              (oldContacts ?? []).filter((contact) => contact.id !== contactId),
            ),
        );
      }

      queryClient.invalidateQueries({
        queryKey: queryKeys.emergencyContacts(elderId),
      });

      showSuccessToast('ลบผู้ติดต่อแล้ว');
    },
    onError: (error: unknown, contactId) => {
      setLocalContacts(sortContactsByPriority(contacts ?? []));

      showErrorMessage('ผิดพลาด', error);
      Logger.error('Delete contact failed', { contactId, error });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (contactIds: string[]) => {
      if (!elderId) {
        throw new Error('ไม่พบข้อมูลผู้สูงอายุ');
      }

      return reorderContacts(elderId, contactIds);
    },
    onSuccess: (_, contactIds) => {
      if (elderId) {
        queryClient.setQueryData<EmergencyContact[]>(
          queryKeys.emergencyContacts(elderId),
          (oldContacts) => (oldContacts ? orderContactsByIds(oldContacts, contactIds) : []),
        );
      }
    },
    onError: (error: unknown) => {
      Logger.error('Reorder failed', error);
      showErrorMessage('ผิดพลาด', error);

      setLocalContacts(sortContactsByPriority(contacts ?? []));
      refetch();
    },
  });

  useEffect(() => {
    if (!contacts) {
      return;
    }

    if (isDraggingRef.current || deleteMutation.isPending || reorderMutation.isPending) {
      return;
    }

    setLocalContacts((previousContacts) => {
      const sortedContacts = sortContactsByPriority(contacts);

      if (hasSameContactOrder(previousContacts, sortedContacts)) {
        return previousContacts;
      }

      return sortedContacts;
    });
  }, [contacts, deleteMutation.isPending, reorderMutation.isPending]);

  const displayContacts = useMemo(() => {
    if (localContacts.length > 0) {
      return localContacts;
    }

    return contacts ?? [];
  }, [contacts, localContacts]);

  const isReorderable = displayContacts.length > 1;
  const isMaxReached = displayContacts.length >= MAX_CONTACTS;

  const handleDelete = useCallback(
    (id: string, name: string) => {
      showDialog('ยืนยันการลบ', `คุณต้องการลบ ${name} ออกจากรายชื่อผู้ติดต่อฉุกเฉินใช่หรือไม่?`, [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: () => {
            setLocalContacts((prevContacts) =>
              normalizeContactsPriority(prevContacts.filter((contact) => contact.id !== id)),
            );

            deleteMutation.mutate(id);
          },
        },
      ]);
    },
    [deleteMutation],
  );

  const handleDragBegin = useCallback((_index: number) => {
    isDraggingRef.current = true;
    Vibration.vibrate(30);
  }, []);

  const handleDragEnd = useCallback(
    ({ data }: { data: EmergencyContact[] }) => {
      const nextContacts = data;
      const shouldSkip =
        nextContacts.length <= 1 || hasSameContactOrder(displayContacts, nextContacts);

      isDraggingRef.current = false;

      requestAnimationFrame(() => {
        setLocalContacts(nextContacts);

        if (shouldSkip) {
          return;
        }

        const contactIds = nextContacts.map((contact) => contact.id);

        InteractionManager.runAfterInteractions(() => {
          reorderMutation.mutate(contactIds);
        });
      });
    },
    [displayContacts, reorderMutation],
  );

  const handleEdit = useCallback(
    (id: string) => {
      if (isNavigating) return;
      setIsNavigating(true);
      router.push({
        pathname: '/(features)/(emergency)/edit',
        params: { id },
      });
    },
    [isNavigating],
  );

  const keyExtractor = useCallback(
    (item: EmergencyContact, index: number) => `${item.id}-${index}`,
    [],
  );

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<EmergencyContact>) => {
      const currentIndex = getIndex();
      const fallbackIndex = displayContacts.findIndex((contact) => contact.id === item.id);
      const displayIndex =
        typeof currentIndex === 'number' && currentIndex >= 0
          ? currentIndex
          : Math.max(fallbackIndex, 0);

      return (
        <ContactItem
          item={item}
          drag={drag}
          isActive={isActive}
          displayIndex={displayIndex}
          isReorderable={isReorderable}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      );
    },
    [isReorderable, handleEdit, handleDelete, displayContacts],
  );

  if (isElderLoading) {
    return <LoadingScreen useScreenWrapper />;
  }

  return (
    <ScreenWrapper
      edges={['top', 'left', 'right']}
      useScrollView={false}
      keyboardAvoiding={false}
      className="flex-1 bg-white"
      header={
        <View
          style={{
            zIndex: 10,
            backgroundColor: 'white',
          }}
        >
          <ScreenHeader
            title="จัดการเบอร์ติดต่อฉุกเฉิน"
            onBack={() => router.back()}
            style={{ paddingBottom: 0 }}
          />

          {elderId && (
            <View className="bg-blue-50 rounded-2xl py-2.5 px-4 mx-6 mt-0 mb-5 flex-row items-start">
              <MaterialIconSolid name="info" size={20} color="#3B82F6" style={{ marginTop: 2 }} />

              <View className="flex-1 ml-2">
                <KanitText className="text-sm text-blue-700" style={{ lineHeight: 20 }}>
                  ระบบจะแสดงเฉพาะ 3 รายชื่อแรกในหน้าโทรฉุกเฉิน
                </KanitText>

                <KanitText className="text-[13px] text-blue-600 mt-0.5" style={{ lineHeight: 18 }}>
                  กดค้างที่ขีด 2 ขีด <MaterialSymbol name="drag_handle" size={14} />{' '}
                  เพื่อลากจัดลำดับความสำคัญ
                </KanitText>
              </View>
            </View>
          )}
        </View>
      }
    >
      {(isLoading && localContacts.length === 0) || isElderLoading ? (
        <View className="flex-1 pt-6 px-6">
          <ListItemSkeleton count={5} />
        </View>
      ) : (
        <View className="flex-1 justify-between">
          <View className="flex-1">
            <DraggableFlatList
              data={displayContacts}
              onDragBegin={handleDragBegin}
              onDragEnd={handleDragEnd}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              activationDistance={8}
              autoscrollThreshold={0}
              autoscrollSpeed={0}
              showsVerticalScrollIndicator={false}
              bounces={false}
              overScrollMode="never"
              scrollEnabled={false}
              removeClippedSubviews={false}
              initialNumToRender={MAX_CONTACTS}
              maxToRenderPerBatch={MAX_CONTACTS}
              windowSize={3}
              dragItemOverflow={false}
              containerStyle={{ flex: 1 }}
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexGrow: displayContacts.length === 0 ? 1 : undefined,
                paddingHorizontal: 24,
                paddingTop: 0,
                paddingBottom: 24,
              }}
              ListEmptyComponent={
                <View className="justify-center items-center py-20" style={{ minHeight: 320 }}>
                  <MaterialIconSolid name="contact_phone" size={80} color="#D1D5DB" />

                  <KanitText className="text-xl text-gray-900 mt-6 text-center">
                    ยังไม่มีรายชื่อผู้ติดต่อ
                  </KanitText>

                  <KanitText className="text-sm text-gray-500 mt-2 text-center">
                    เพิ่มเบอร์ติดต่อฉุกเฉินเพื่อให้คุณสามารถกดโทรออกได้ทันทีเมื่อเกิดเหตุ
                  </KanitText>
                </View>
              }
            />
          </View>

          {elderId && (
            <View
              testID="emergency-contacts-list-footer"
              className="bg-white border-t border-gray-100 px-6 pt-4 shadow-sm"
              style={{
                paddingBottom: navBarInset > 0 ? navBarInset : 16,
              }}
            >
              <TouchableOpacity
                testID="add-emergency-contact-button"
                onPress={() => {
                  if (isNavigating) return;
                  setIsNavigating(true);
                  router.push('/(features)/(emergency)/add');
                }}
                className={`rounded-2xl py-4 flex-row justify-center items-center ${
                  isMaxReached ? 'bg-gray-200' : 'bg-[#16AD78]'
                }`}
                activeOpacity={0.8}
                disabled={isMaxReached || isNavigating}
              >
                {!isMaxReached && (
                  <MaterialSymbol name="add" size={24} color="#FFFFFF" style={{ marginRight: 8 }} />
                )}

                <KanitText
                  className={`text-lg font-medium ${isMaxReached ? 'text-gray-500' : 'text-white'}`}
                >
                  {isMaxReached ? 'ครบจำนวนแล้ว' : 'เพิ่มเบอร์ติดต่อฉุกเฉิน'}
                </KanitText>
              </TouchableOpacity>

              <KanitText className="text-xs text-gray-500 mt-2 text-center">
                เพิ่มได้สูงสุด {MAX_CONTACTS} เบอร์
              </KanitText>
            </View>
          )}
        </View>
      )}
    </ScreenWrapper>
  );
}
