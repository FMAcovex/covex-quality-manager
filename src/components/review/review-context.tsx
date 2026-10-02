"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { QmsRecordType } from "@prisma/client";
import type { ReviewTargetInstance } from "@/lib/qms/review/targets/types";
import {
  reviewThreadMatchesTarget,
  type ReviewThreadView,
} from "@/lib/qms/review/ui-model";

type ReviewContextValue = {
  qmsRecordId: string;
  module: QmsRecordType;
  basePath: string;
  currentVersionLabel: string;
  defaultActor: string;
  reviewMode: boolean;
  targets: ReviewTargetInstance[];
  threads: ReviewThreadView[];
  selectedTarget: ReviewTargetInstance | null;
  selectedThread: ReviewThreadView | null;
  drawerOpen: boolean;
  openTarget: (target: ReviewTargetInstance) => void;
  openThread: (reviewThreadId: string) => void;
  closeDrawer: () => void;
  refresh: (reviewThreadId?: string | null) => void;
  targetForThread: (thread: ReviewThreadView) => ReviewTargetInstance | null;
  threadsForTarget: (target: ReviewTargetInstance) => ReviewThreadView[];
};

const ReviewContext = createContext<ReviewContextValue | null>(null);

export function ReviewWorkspaceProvider({
  children,
  qmsRecordId,
  module,
  basePath,
  currentVersionLabel,
  defaultActor,
  reviewMode,
  targets,
  threads,
  initialThreadId,
}: {
  children: ReactNode;
  qmsRecordId: string;
  module: QmsRecordType;
  basePath: string;
  currentVersionLabel: string;
  defaultActor: string;
  reviewMode: boolean;
  targets: ReviewTargetInstance[];
  threads: ReviewThreadView[];
  initialThreadId?: string | null;
}) {
  const router = useRouter();
  const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialThreadId ?? null,
  );

  useEffect(() => {
    if (initialThreadId) setSelectedThreadId(initialThreadId);
  }, [initialThreadId]);

  const targetForThread = useCallback(
    (thread: ReviewThreadView) =>
      targets.find((target) => reviewThreadMatchesTarget(thread, target)) ?? null,
    [targets],
  );
  const threadsForTarget = useCallback(
    (target: ReviewTargetInstance) =>
      threads.filter((thread) => reviewThreadMatchesTarget(thread, target)),
    [threads],
  );
  const selectedThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? null;
  const selectedTarget = selectedThread
    ? targetForThread(selectedThread)
    : targets.find((target) => target.key === selectedTargetKey) ?? null;

  const openTarget = useCallback(
    (target: ReviewTargetInstance) => {
      const matching = threadsForTarget(target);
      setSelectedTargetKey(target.key);
      setSelectedThreadId(matching[0]?.id ?? null);
    },
    [threadsForTarget],
  );
  const openThread = useCallback(
    (reviewThreadId: string) => {
      const thread = threads.find((item) => item.id === reviewThreadId);
      setSelectedThreadId(reviewThreadId);
      setSelectedTargetKey(thread ? targetForThread(thread)?.key ?? null : null);
    },
    [targetForThread, threads],
  );
  const closeDrawer = useCallback(() => {
    setSelectedThreadId(null);
    setSelectedTargetKey(null);
  }, []);
  const refresh = useCallback(
    (reviewThreadId?: string | null) => {
      if (reviewThreadId) setSelectedThreadId(reviewThreadId);
      router.refresh();
    },
    [router],
  );

  const value = useMemo<ReviewContextValue>(
    () => ({
      qmsRecordId,
      module,
      basePath,
      currentVersionLabel,
      defaultActor,
      reviewMode,
      targets,
      threads,
      selectedTarget,
      selectedThread,
      drawerOpen: reviewMode && Boolean(selectedTarget || selectedThread),
      openTarget,
      openThread,
      closeDrawer,
      refresh,
      targetForThread,
      threadsForTarget,
    }),
    [
      qmsRecordId,
      module,
      basePath,
      currentVersionLabel,
      defaultActor,
      reviewMode,
      targets,
      threads,
      selectedTarget,
      selectedThread,
      openTarget,
      openThread,
      closeDrawer,
      refresh,
      targetForThread,
      threadsForTarget,
    ],
  );

  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}

export function useReviewWorkspace() {
  const value = useContext(ReviewContext);
  if (!value) throw new Error("Review components require ReviewWorkspaceProvider.");
  return value;
}
