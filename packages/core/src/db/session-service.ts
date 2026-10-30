/**
 * File: packages/core/src/db/session-service.ts
 * Module: @cook/core
 *
 * Quản lý trạng thái phiên nấu ăn cục bộ trong SQLite (cook_session, cook_step_state).
 * Nhận vào: SqlDriver (tùy chọn), recipe, và mọi hàm nhận `now` từ bên ngoài (không dùng đồng hồ thật).
 * Trả ra: Trạng thái phiên chia thành 3 nhóm (now, waiting, next), hẹn giờ, và kiểm tra an toàn theo T04.
 * Ai gọi: CookScreen, TimerService, Acceptance tests T07-T09.
 * Bám theo: docs/expected/T07.md (ca S, ca R, ca X) và docs/tasks.md mục T07.
 */

import { SqlDriver } from './driver.js';
import type { RecipeStep } from '../schemas/recipe.js';
import type { CookSession, RunningTimer } from '../schemas/session.js';
import { checkManualStart } from '../scheduler/manual-check.js';
import { replan } from '../scheduler/replan.js';
import { plan } from '../scheduler/plan.js';
import type {
  CheckManualStartResult,
  OptimizationMode,
  RecipeOrSteps,
  ScheduledStep,
} from '../scheduler/types.js';

export interface StartSessionOptions {
  servings?: number;
  mode?: OptimizationMode;
  removedOrSubstituted?: Record<string, string | null>;
  now: number;
  sessionId?: string;
}

export interface StepRemainingInfo {
  remaining: number;
  overdue_by: number;
  state: 'waiting' | 'elapsed';
}

export interface SessionSnapshot {
  id: string;
  recipe_id: string;
  recipe_version: number;
  servings: number;
  optimization_mode: OptimizationMode;
  started_at: string;
  completed_at: string | null;
  session_status: 'cooking' | 'done' | 'abandoned';
  now_group: string[];
  waiting: string[];
  next: string[];
  step_states: Record<string, string>;
  running_timers: RunningTimer[];
  replan?: Array<{ step: string; start: number; end: number }>;
  remaining?: Record<string, number>;
  auto_done?: string[];
  notifications: number;
}

/**
 * Tính số giây còn lại và trạng thái hẹn giờ thuần túy (Ca T).
 */
export function computeRemaining(endsAt: number, now: number): StepRemainingInfo {
  if (now < endsAt) {
    return {
      remaining: endsAt - now,
      overdue_by: 0,
      state: 'waiting',
    };
  }
  return {
    remaining: 0,
    overdue_by: now - endsAt,
    state: 'elapsed',
  };
}

export class SessionService {
  private driver?: SqlDriver;
  private currentSession: CookSession | null = null;
  private currentSteps: RecipeStep[] = [];
  private stepFinishTimes: Record<string, number> = {};
  private activeTimers: Map<string, RunningTimer> = new Map();
  private lastReplan?: ScheduledStep[];

  constructor(driver?: SqlDriver) {
    this.driver = driver;
  }

  /**
   * Khởi tạo phiên nấu ăn mới (Ca S1).
   * Bắt đầu phiên thứ hai khi phiên đầu đang cooking sẽ ném lỗi SESSION_ALREADY_ACTIVE.
   */
  async start(
    recipeOrSteps: RecipeOrSteps,
    options: StartSessionOptions
  ): Promise<SessionSnapshot> {
    const now = options.now;

    // Kiểm tra nếu đã có phiên đang nấu trong bộ nhớ
    if (this.currentSession && this.currentSession.status === 'cooking') {
      throw new Error('SESSION_ALREADY_ACTIVE');
    }

    // Kiểm tra trong CSDL SQLite nếu có driver
    if (this.driver) {
      const activeRows = await this.driver.query<CookSession>(
        "SELECT * FROM cook_session WHERE status = 'cooking' LIMIT 1"
      );
      if (activeRows.length > 0) {
        throw new Error('SESSION_ALREADY_ACTIVE');
      }
    }

    const steps: RecipeStep[] =
      'steps' in recipeOrSteps ? recipeOrSteps.steps : [];
    this.currentSteps = steps;
    this.stepFinishTimes = {};
    this.activeTimers.clear();
    this.lastReplan = undefined;

    const recipeId =
      'id' in recipeOrSteps && typeof recipeOrSteps.id === 'string'
        ? recipeOrSteps.id
        : 'dish';
    const recipeVersion =
      'version' in recipeOrSteps && typeof recipeOrSteps.version === 'number'
        ? recipeOrSteps.version
        : 1;
    const servings =
      options.servings ||
      ('servings_base' in recipeOrSteps && typeof recipeOrSteps.servings_base === 'number'
        ? recipeOrSteps.servings_base
        : 2);
    const mode = options.mode || 'fastest';
    const sessionId =
      options.sessionId ||
      `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const initialStepStates: Record<string, string> = {};
    for (const step of steps) {
      initialStepStates[step.id] = 'pending';
    }

    this.currentSession = {
      id: sessionId,
      recipe_id: recipeId,
      recipe_version: recipeVersion,
      servings,
      optimization_mode: mode,
      started_at: String(now),
      completed_at: null,
      status: 'cooking',
      step_states: initialStepStates,
      removed_or_substituted: options.removedOrSubstituted || {},
      running_timers: [],
    };

    if (this.driver) {
      await this.driver.execute(
        `INSERT INTO cook_session (
          id, recipe_id, recipe_version, servings, optimization_mode,
          started_at, completed_at, status, step_states, removed_or_substituted, running_timers
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          recipeId,
          recipeVersion,
          servings,
          mode,
          String(now),
          null,
          'cooking',
          JSON.stringify(initialStepStates),
          JSON.stringify(options.removedOrSubstituted || {}),
          JSON.stringify([]),
        ]
      );
    }

    return this.buildSnapshot(now);
  }

  /**
   * Người dùng bấm "Đã bắt đầu" bước passive lúc now (Ca S2).
   * endsAt = now + step.seconds, đặt đúng 1 thông báo.
   */
  async startPassive(stepId: string, now: number): Promise<SessionSnapshot> {
    if (!this.currentSession || this.currentSession.status !== 'cooking') {
      throw new Error('NO_ACTIVE_SESSION');
    }

    const step = this.currentSteps.find((s) => s.id === stepId);
    if (!step || step.kind !== 'passive') {
      throw new Error(`Step ${stepId} is not a passive step`);
    }

    const endsAt = now + step.seconds;
    const timer: RunningTimer = {
      id: `timer_${stepId}`,
      step_id: stepId,
      label: step.title || step.text || stepId,
      endsAt,
    };

    this.activeTimers.set(stepId, timer);
    this.currentSession.step_states[stepId] = 'waiting';
    this.syncRunningTimersToSession();

    await this.persistSession();
    return this.buildSnapshot(now);
  }

  /**
   * Đặt hẹn giờ thủ công cho bất kỳ bước nào (Ca T, 3. Hẹn giờ tay).
   */
  async setManualTimer(
    seconds: number,
    now: number,
    label?: string,
    stepId?: string
  ): Promise<{ timer: RunningTimer; snapshot: SessionSnapshot }> {
    if (!this.currentSession || this.currentSession.status !== 'cooking') {
      throw new Error('NO_ACTIVE_SESSION');
    }

    const endsAt = now + seconds;
    const timerId = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const timer: RunningTimer = {
      id: timerId,
      step_id: stepId,
      label: label || 'Hẹn giờ tay',
      endsAt,
    };

    this.activeTimers.set(timerId, timer);
    this.syncRunningTimersToSession();

    await this.persistSession();
    return {
      timer,
      snapshot: this.buildSnapshot(now),
    };
  }

  /**
   * Kiểm tra và tự động cập nhật các bước passive đã hết giờ (Ca S5, Ca R).
   * Bước passive tự hoàn tất đúng lúc endsAt (không cần bấm Xong).
   */
  async tick(
    now: number
  ): Promise<{
    snapshot: SessionSnapshot;
    autoDoneSteps: string[];
    notificationsFired: number;
  }> {
    if (!this.currentSession || this.currentSession.status !== 'cooking') {
      throw new Error('NO_ACTIVE_SESSION');
    }

    const autoDone: string[] = [];
    let firedCount = 0;

    for (const [key, timer] of Array.from(this.activeTimers.entries())) {
      const endsAtNum = Number(timer.endsAt);
      if (now >= endsAtNum) {
        if (timer.step_id) {
          this.currentSession.step_states[timer.step_id] = 'completed';
          this.stepFinishTimes[timer.step_id] = endsAtNum;
          autoDone.push(timer.step_id);
        }
        this.activeTimers.delete(key);
        firedCount++;
      }
    }

    // Kiểm tra nếu mọi bước đã hoàn thành
    this.checkIfAllStepsDone(now);

    this.syncRunningTimersToSession();
    await this.persistSession();

    const snapshot = this.buildSnapshot(now, autoDone);
    return {
      snapshot,
      autoDoneSteps: autoDone,
      notificationsFired: firedCount,
    };
  }

  /**
   * Đánh dấu hoàn thành bước (Ca S3, S4, S6, Ca X).
   * Kiểm tra quy tắc an toàn bằng checkManualStart của T04.
   */
  async markDone(
    stepId: string,
    now: number,
    safetyConfirmed: boolean = false
  ): Promise<{
    success: boolean;
    snapshot: SessionSnapshot;
    safetyResult?: CheckManualStartResult;
  }> {
    if (!this.currentSession || this.currentSession.status !== 'cooking') {
      throw new Error('NO_ACTIVE_SESSION');
    }

    const step = this.currentSteps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found`);
    }

    // Cập nhật các bước passive đã hết giờ trước khi tính toán
    for (const [key, timer] of Array.from(this.activeTimers.entries())) {
      const endsAtNum = Number(timer.endsAt);
      if (now >= endsAtNum && timer.step_id) {
        this.currentSession.step_states[timer.step_id] = 'completed';
        this.stepFinishTimes[timer.step_id] = endsAtNum;
        this.activeTimers.delete(key);
      }
    }

    const doneStepIds = this.getDoneStepIds();

    // 1. Kiểm tra an toàn bằng checkManualStart (T04, Ca X)
    const safetyCheck = checkManualStart(
      { steps: this.currentSteps },
      stepId,
      doneStepIds,
      safetyConfirmed
    );

    if (safetyCheck.level === 'blocked') {
      return {
        success: false,
        snapshot: this.buildSnapshot(now),
        safetyResult: safetyCheck,
      };
    }

    // 2. Đánh dấu bước xong
    this.currentSession.step_states[stepId] = 'completed';
    this.stepFinishTimes[stepId] = now;
    this.activeTimers.delete(stepId);
    this.activeTimers.delete(`timer_${stepId}`);

    // 3. Tính lại kế hoạch cho các bước còn lại từ mốc now (Ca S3 replan)
    const runningPassiveMap: Record<string, { start: number; endsAt: number }> = {};
    for (const timer of this.activeTimers.values()) {
      if (timer.step_id) {
        const pStep = this.currentSteps.find((s) => s.id === timer.step_id);
        const endsAtNum = Number(timer.endsAt);
        const sec = pStep?.seconds || 0;
        runningPassiveMap[timer.step_id] = {
          start: Math.max(0, endsAtNum - sec),
          endsAt: endsAtNum,
        };
      }
    }

    this.lastReplan = replan(
      { steps: this.currentSteps },
      {
        done: this.stepFinishTimes,
        running_passive: runningPassiveMap,
      },
      now,
      this.currentSession.optimization_mode
    );

    // 4. Kiểm tra hoàn tất toàn bộ phiên
    this.checkIfAllStepsDone(now);

    this.syncRunningTimersToSession();
    await this.persistSession();

    return {
      success: true,
      snapshot: this.buildSnapshot(now),
      safetyResult: safetyCheck,
    };
  }

  /**
   * Bỏ dở phiên nấu ăn (Ca X).
   * Chuyển trạng thái sang abandoned, hủy mọi thông báo.
   */
  async abandon(now: number): Promise<SessionSnapshot> {
    if (!this.currentSession) {
      throw new Error('NO_ACTIVE_SESSION');
    }

    this.currentSession.status = 'abandoned';
    this.currentSession.completed_at = String(now);
    this.activeTimers.clear();
    this.syncRunningTimersToSession();

    await this.persistSession();
    return this.buildSnapshot(now);
  }

  /**
   * Hoàn tất phiên nấu (Ca S6).
   */
  async finish(now: number): Promise<SessionSnapshot> {
    if (!this.currentSession) {
      throw new Error('NO_ACTIVE_SESSION');
    }

    this.currentSession.status = 'done';
    this.currentSession.completed_at = String(now);
    this.activeTimers.clear();
    this.syncRunningTimersToSession();

    await this.persistSession();
    return this.buildSnapshot(now);
  }

  /**
   * Phục hồi phiên nấu khi mở lại app giữa chừng (Ca R).
   */
  async restore(
    sessionId: string | null,
    now: number,
    stepsOverride?: RecipeStep[]
  ): Promise<{ snapshot: SessionSnapshot; notificationsFireNow: number } | null> {
    if (stepsOverride && stepsOverride.length > 0) {
      this.currentSteps = stepsOverride;
    }

    let sessionToRestore: CookSession | null = this.currentSession;

    if (this.driver) {
      let query = "SELECT * FROM cook_session WHERE status = 'cooking'";
      const params: (string | number)[] = [];
      if (sessionId) {
        query += ' AND id = ?';
        params.push(sessionId);
      }
      query += ' ORDER BY started_at DESC LIMIT 1';

      const rows = await this.driver.query<Record<string, unknown>>(query, params);
      if (rows.length > 0) {
        const row = rows[0]!;
        sessionToRestore = {
          id: String(row.id),
          recipe_id: String(row.recipe_id),
          recipe_version: Number(row.recipe_version),
          servings: Number(row.servings),
          optimization_mode: row.optimization_mode as OptimizationMode,
          started_at: String(row.started_at),
          completed_at: row.completed_at ? String(row.completed_at) : null,
          status: row.status as 'cooking' | 'done' | 'abandoned',
          step_states:
            typeof row.step_states === 'string'
              ? JSON.parse(row.step_states)
              : (row.step_states as Record<string, string>) || {},
          removed_or_substituted:
            typeof row.removed_or_substituted === 'string'
              ? JSON.parse(row.removed_or_substituted)
              : (row.removed_or_substituted as Record<string, string | null>) || {},
          running_timers:
            typeof row.running_timers === 'string'
              ? JSON.parse(row.running_timers)
              : (row.running_timers as RunningTimer[]) || [],
        };
      }
    }

    if (!sessionToRestore) {
      return null;
    }

    this.currentSession = sessionToRestore;
    this.activeTimers.clear();

    // Nạp lại running_timers
    for (const timer of sessionToRestore.running_timers) {
      const key = timer.step_id || timer.id;
      this.activeTimers.set(key, timer);
    }

    // Tự động kiểm tra các bước đã hết giờ tính đến mốc now
    let notificationsFireNow = 0;
    const autoDone: string[] = [];

    for (const [key, timer] of Array.from(this.activeTimers.entries())) {
      const endsAtNum = Number(timer.endsAt);
      if (now >= endsAtNum) {
        if (timer.step_id) {
          this.currentSession.step_states[timer.step_id] = 'completed';
          this.stepFinishTimes[timer.step_id] = endsAtNum;
          autoDone.push(timer.step_id);
        }
        this.activeTimers.delete(key);
        notificationsFireNow++;
      }
    }

    this.checkIfAllStepsDone(now);
    this.syncRunningTimersToSession();
    await this.persistSession();

    return {
      snapshot: this.buildSnapshot(now, autoDone),
      notificationsFireNow,
    };
  }

  /**
   * Tính toán và trả về snapshot 3 nhóm (now, waiting, next) bám sát Ca S, Ca R.
   */
  private buildSnapshot(now: number, autoDone: string[] = []): SessionSnapshot {
    if (!this.currentSession) {
      throw new Error('NO_ACTIVE_SESSION');
    }

    const doneSet = new Set(this.getDoneStepIds());
    const waitingList: string[] = [];
    const remainingMap: Record<string, number> = {};

    // 1. Nhóm waiting: các bước passive đang đếm giờ
    for (const timer of this.activeTimers.values()) {
      if (timer.step_id) {
        waitingList.push(timer.step_id);
        const endsAtNum = Number(timer.endsAt);
        const rem = Math.max(0, endsAtNum - now);
        remainingMap[timer.step_id] = rem;
      }
    }

    // 2. Nhóm now và next:
    // - Bước passive: nếu dependencies đã xong và chưa bắt đầu (không nằm trong waiting) -> thuộc now!
    // - Bước active: người nấu chỉ làm 1 bước active tại một thời điểm (bước active sẵn sàng đầu tiên theo lịch trình).
    // - Tất cả các bước chưa xong khác -> thuộc next!
    const nowList: string[] = [];
    const nextList: string[] = [];

    // Tìm thứ tự lịch trình của các bước còn lại
    let scheduleOrder: string[] = [];
    if (this.lastReplan && this.lastReplan.length > 0) {
      scheduleOrder = this.lastReplan.map((s) => s.step_id);
    } else {
      try {
        const fullPlan = plan(
          { steps: this.currentSteps },
          this.currentSession.servings,
          this.currentSession.optimization_mode
        );
        scheduleOrder = fullPlan.map((s) => s.step_id);
      } catch {
        scheduleOrder = this.currentSteps.map((s) => s.id);
      }
    }

    // Các bước chưa xong và chưa nằm trong waiting
    const unstartedSteps = this.currentSteps.filter(
      (s) =>
        !doneSet.has(s.id) &&
        !this.activeTimers.has(s.id) &&
        !this.activeTimers.has(`timer_${s.id}`)
    );

    // 2a. Thêm các bước passive sẵn sàng vào nowList
    for (const step of unstartedSteps) {
      if (step.kind === 'passive') {
        const isDepMet = (step.after || []).every((dep) => doneSet.has(dep));
        if (isDepMet) {
          nowList.push(step.id);
        } else {
          nextList.push(step.id);
        }
      }
    }

    // 2b. Trong các bước active sẵn sàng, chọn duy nhất bước đầu tiên theo scheduleOrder vào nowList
    const readyActiveSteps = unstartedSteps.filter((step) => {
      if (step.kind !== 'active') return false;
      return (step.after || []).every((dep) => doneSet.has(dep));
    });

    readyActiveSteps.sort((a, b) => {
      const idxA = scheduleOrder.indexOf(a.id);
      const idxB = scheduleOrder.indexOf(b.id);
      const posA = idxA === -1 ? 9999 : idxA;
      const posB = idxB === -1 ? 9999 : idxB;
      return posA - posB;
    });

    const recommendedActiveStep = readyActiveSteps[0];
    if (recommendedActiveStep) {
      nowList.push(recommendedActiveStep.id);
    }

    // Các bước active sẵn sàng còn lại (từ vị trí 1 trở đi) cho vào nextList
    for (let i = 1; i < readyActiveSteps.length; i++) {
      nextList.push(readyActiveSteps[i]!.id);
    }

    // Các bước active chưa sẵn sàng (chưa xong dependencies) cho vào nextList
    for (const step of unstartedSteps) {
      if (step.kind === 'active') {
        const isDepMet = (step.after || []).every((dep) => doneSet.has(dep));
        if (!isDepMet) {
          nextList.push(step.id);
        }
      }
    }

    // Định dạng lại danh sách replan nếu có
    let replanSummary: Array<{ step: string; start: number; end: number }> | undefined;
    if (this.lastReplan && this.lastReplan.length > 0) {
      replanSummary = this.lastReplan.map((s) => ({
        step: s.step_id,
        start: s.start_at,
        end: s.end_at,
      }));
    }

    return {
      id: this.currentSession.id,
      recipe_id: this.currentSession.recipe_id,
      recipe_version: this.currentSession.recipe_version,
      servings: this.currentSession.servings,
      optimization_mode: this.currentSession.optimization_mode,
      started_at: this.currentSession.started_at,
      completed_at: this.currentSession.completed_at || null,
      session_status: this.currentSession.status,
      now_group: nowList,
      waiting: waitingList,
      next: nextList,
      step_states: { ...this.currentSession.step_states },
      running_timers: [...this.currentSession.running_timers],
      replan: replanSummary,
      remaining: Object.keys(remainingMap).length > 0 ? remainingMap : undefined,
      auto_done: autoDone.length > 0 ? autoDone : undefined,
      notifications: this.currentSession.status === 'cooking' ? this.activeTimers.size : 0,
    };
  }

  private getDoneStepIds(): string[] {
    if (!this.currentSession) return [];
    return Object.entries(this.currentSession.step_states)
      .filter(([_, state]) => state === 'completed')
      .map(([id]) => id);
  }

  private checkIfAllStepsDone(now: number): void {
    if (!this.currentSession) return;
    const allDone =
      this.currentSteps.length > 0 &&
      this.currentSteps.every(
        (s) => this.currentSession!.step_states[s.id] === 'completed'
      );
    if (allDone) {
      this.currentSession.status = 'done';
      this.currentSession.completed_at = String(now);
      this.activeTimers.clear();
    }
  }

  private syncRunningTimersToSession(): void {
    if (!this.currentSession) return;
    this.currentSession.running_timers = Array.from(this.activeTimers.values());
  }

  private async persistSession(): Promise<void> {
    if (!this.driver || !this.currentSession) return;
    await this.driver.execute(
      `UPDATE cook_session SET
        status = ?,
        completed_at = ?,
        step_states = ?,
        running_timers = ?
      WHERE id = ?`,
      [
        this.currentSession.status,
        this.currentSession.completed_at,
        JSON.stringify(this.currentSession.step_states),
        JSON.stringify(this.currentSession.running_timers),
        this.currentSession.id,
      ]
    );
  }
}
