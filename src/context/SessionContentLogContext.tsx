import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import i18n from '../i18n';
import { supabase } from '../lib/supabase';
import {
  buildSessionContentLogInsert,
  buildSessionContentSummary,
  createSessionContentCounters,
  hasContentRuns,
  recordContentRun,
  type ContentRunInput,
  type SessionContentCounters,
} from '../lib/sessionContentLog';
import { useAuth } from './AuthContext';

export interface SessionContentLogContextValue {
  flushSessionContentLog: () => Promise<void>;
  trackContentRun: (input: ContentRunInput) => void;
  trackContentRuns: (inputs: ContentRunInput[]) => void;
}

const SessionContentLogContext = createContext<SessionContentLogContextValue | null>(null);

function createSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getAppVersion(): string {
  return Constants.expoConfig?.version ?? 'unknown';
}

export function SessionContentLogProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const countersRef = useRef<SessionContentCounters>(createSessionContentCounters());
  const isFlushingRef = useRef(false);
  const sessionIdRef = useRef(createSessionId());
  const startedAtRef = useRef(new Date().toISOString());

  const resetSessionCounters = useCallback(() => {
    countersRef.current = createSessionContentCounters();
    sessionIdRef.current = createSessionId();
    startedAtRef.current = new Date().toISOString();
  }, []);

  useEffect(() => {
    resetSessionCounters();
  }, [resetSessionCounters, user?.id]);

  const trackContentRun = useCallback(
    (input: ContentRunInput) => {
      if (!user?.id) return;
      recordContentRun(countersRef.current, input);
    },
    [user?.id],
  );

  const trackContentRuns = useCallback(
    (inputs: ContentRunInput[]) => {
      if (!user?.id) return;
      inputs.forEach((input) => recordContentRun(countersRef.current, input));
    },
    [user?.id],
  );

  const flushSessionContentLog = useCallback(async () => {
    if (!user?.id || isFlushingRef.current || !hasContentRuns(countersRef.current)) return;

    isFlushingRef.current = true;
    const summary = buildSessionContentSummary({
      appVersion: getAppVersion(),
      counters: countersRef.current,
      endedAt: new Date().toISOString(),
      locale: i18n.language,
      sessionId: sessionIdRef.current,
      startedAt: startedAtRef.current,
      userId: user.id,
    });

    resetSessionCounters();

    try {
      await supabase.from('session_content_logs').insert(buildSessionContentLogInsert(summary));
    } catch {
      // Best-effort telemetry only; failed sends are intentionally dropped.
    } finally {
      isFlushingRef.current = false;
    }
  }, [resetSessionCounters, user?.id]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        void flushSessionContentLog();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
      void flushSessionContentLog();
    };
  }, [flushSessionContentLog]);

  return (
    <SessionContentLogContext.Provider
      value={{ flushSessionContentLog, trackContentRun, trackContentRuns }}
    >
      {children}
    </SessionContentLogContext.Provider>
  );
}

export function useSessionContentLog(): SessionContentLogContextValue {
  const context = useContext(SessionContentLogContext);
  if (!context) {
    throw new Error('useSessionContentLog must be used within SessionContentLogProvider');
  }
  return context;
}
