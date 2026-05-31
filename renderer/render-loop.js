export function createOnDemandRenderLoop({ requestFrame = defaultRequestFrame, cancelFrame = defaultCancelFrame } = {}) {
  let pendingFrameId = null;
  let pendingPromise = null;
  let pendingResolve = null;
  let pendingReject = null;
  let pendingTask = null;

  return {
    schedule,
    cancel
  };

  function schedule(task) {
    pendingTask = task;

    if (pendingPromise) {
      return pendingPromise;
    }

    pendingPromise = new Promise((resolve, reject) => {
      pendingResolve = resolve;
      pendingReject = reject;
    });

    pendingFrameId = requestFrame(async () => {
      const taskToRun = pendingTask;
      pendingTask = null;
      pendingFrameId = null;

      try {
        await taskToRun?.();
        pendingResolve?.();
      } catch (error) {
        pendingReject?.(error);
      } finally {
        const nextTask = pendingTask;
        pendingPromise = null;
        pendingResolve = null;
        pendingReject = null;

        if (nextTask) {
          schedule(nextTask);
        }
      }
    });

    return pendingPromise;
  }

  function cancel() {
    if (pendingFrameId !== null) {
      cancelFrame(pendingFrameId);
      pendingFrameId = null;
    }

    pendingTask = null;

    if (pendingReject) {
      pendingReject(new Error('Render was canceled.'));
    }

    pendingPromise = null;
    pendingResolve = null;
    pendingReject = null;
  }
}

function defaultRequestFrame(callback) {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback);
  }

  return setTimeout(() => callback(Date.now()), 0);
}

function defaultCancelFrame(handle) {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle);
    return;
  }

  clearTimeout(handle);
}