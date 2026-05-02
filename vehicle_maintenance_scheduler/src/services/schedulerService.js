function normalizeTask(rawTask) {
  return {
    taskId: rawTask.TaskID || rawTask.taskId || "",
    duration: Number(rawTask.Duration || rawTask.duration || 0),
    impact: Number(rawTask.Impact || rawTask.impact || 0)
  };
}

function chooseTasksWithinHours(tasks, mechanicHours) {
  const normalized = tasks
    .map(normalizeTask)
    .filter((task) => task.duration > 0 && task.impact > 0);

  const n = normalized.length;
  const capacity = Math.max(0, Number(mechanicHours || 0));

  const bestImpactAtHour = Array(capacity + 1).fill(0);
  const picked = Array.from({ length: n }, () => Array(capacity + 1).fill(false));

  for (let i = 0; i < n; i += 1) {
    const task = normalized[i];

    for (let hours = capacity; hours >= task.duration; hours -= 1) {
      const withCurrentTask = bestImpactAtHour[hours - task.duration] + task.impact;
      const withoutCurrentTask = bestImpactAtHour[hours];

      if (withCurrentTask > withoutCurrentTask) {
        bestImpactAtHour[hours] = withCurrentTask;
        picked[i][hours] = true;
      }
    }
  }

  const selected = [];
  let remainingHours = capacity;

  for (let i = n - 1; i >= 0; i -= 1) {
    if (!picked[i][remainingHours]) {
      continue;
    }

    const task = normalized[i];
    selected.push(task);
    remainingHours -= task.duration;
  }

  selected.reverse();

  const totalDuration = selected.reduce((sum, task) => sum + task.duration, 0);
  const totalImpact = selected.reduce((sum, task) => sum + task.impact, 0);

  return {
    mechanicHours: capacity,
    totalDuration,
    totalImpact,
    remainingHours: capacity - totalDuration,
    selectedTasks: selected
  };
}

function buildDepotSchedules(depots, vehicles) {
  return depots.map((depot) => {
    const depotId = Number(depot.ID || depot.id || 0);
    const mechanicHours = Number(depot.MechanicHours || depot.mechanicHours || 0);

    const schedule = chooseTasksWithinHours(vehicles, mechanicHours);

    return {
      depotId,
      ...schedule
    };
  });
}

module.exports = {
  chooseTasksWithinHours,
  buildDepotSchedules
};

