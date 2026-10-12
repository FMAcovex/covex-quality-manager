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
import { highlightReviewTarget } from "@/lib/qms/review/navigation";
import { usePresentationAccess } from "@/components/permissions";
import type { QmsRecordType } from "@prisma/client";
import type { ReviewTargetInstance } from "@/lib/qms/review/targets/types";
import {
  reviewThreadMatchesTarget,
  type ReviewThreadView,
  type ReviewVersionLabelMode,
} from "@/lib/qms/review/ui-model";

export type ReviewRecordVersionAssociation = "CURRENT" | "NONE";

type ReviewContextValue = {
  qmsRecordId: string;
  module: QmsRecordType;
  basePath: string;
  currentVersionLabel: string;
  versionLabelMode: ReviewVersionLabelMode;
  showVersionContext: boolean;
  recordVersionAssociation: ReviewRecordVersionAssociation;
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
  refresh: (reviewThreadId?: string | null, updatedThreads?: ReviewThreadView[]) => void;
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
  versionLabelMode = "VERSION",
  showVersionContext = true,
  recordVersionAssociation = "CURRENT",
  defaultActor: suppliedActor,
  reviewMode,
  targets,
  threads: serverThreads,
  initialThreadId,
}: {
  children: ReactNode;
  qmsRecordId: string;
  module: QmsRecordType;
  basePath: string;
  currentVersionLabel: string;
  versionLabelMode?: ReviewVersionLabelMode;
  showVersionContext?: boolean;
  recordVersionAssociation?: ReviewRecordVersionAssociation;
  defaultActor: string;
  reviewMode: boolean;
  targets: ReviewTargetInstance[];
  threads: ReviewThreadView[];
  initialThreadId?: string | null;
}) {
  const access = usePresentationAccess();
  const defaultActor = access?.actor ?? suppliedActor;
  const canReview = Boolean(access?.current.REVIEW);
  const [threads, setThreads] = useState(serverThreads);
  useEffect(() => setThreads(serverThreads), [serverThreads]);
  const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialThreadId ?? null,
  );

  useEffect(() => {
    if (initialThreadId) {
      // Field links expose the highlighted target; thread-only links open the drawer.
      setSelectedThreadId(window.location.hash ? null : initialThreadId);
      setSelectedTargetKey(null);
    }
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

  useEffect(() => {
    if (!reviewMode) return;
    const initialThread = threads.find((item) => item.id === initialThreadId);
    const target = initialThread ? targetForThread(initialThread) : null;
    const url = new URL(window.location.href);
    const renderedTab = url.searchParams.get("tab") ?? (module === "CHANGE_CONTROL" ? "information" : "summary");
    if (target && renderedTab !== target.tabKey) {
      // Preserve whether the caller requested the drawer or a field anchor.
      url.searchParams.set("tab", target.tabKey);
      window.location.replace(`${basePath}?${url.searchParams.toString()}${url.hash}`);
      return;
    }
    const anchor = target?.anchorId ?? url.hash.slice(1);
    if (anchor) return highlightReviewTarget(anchor);
  }, [basePath, initialThreadId, module, reviewMode, targetForThread, targets, threads]);

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
    (reviewThreadId?: string | null, updatedThreads?: ReviewThreadView[]) => {
      // Server Actions revalidate detail/list data in their response. A second
      // client refresh inside the mutation transition can suspend stale props.
      if (reviewThreadId) setSelectedThreadId(reviewThreadId);
      if (updatedThreads) setThreads(updatedThreads);
    },
    [],
  );

  const value = useMemo<ReviewContextValue>(
    () => ({
      qmsRecordId,
      module,
      basePath,
      currentVersionLabel,
      versionLabelMode,
      showVersionContext,
      recordVersionAssociation,
      defaultActor,
      reviewMode,
      targets,
      threads,
      selectedTarget,
      selectedThread,
      drawerOpen: (!canReview || reviewMode) && Boolean(selectedTarget || selectedThread),
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
      versionLabelMode,
      showVersionContext,
      recordVersionAssociation,
      defaultActor,
      reviewMode,
      canReview,
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
