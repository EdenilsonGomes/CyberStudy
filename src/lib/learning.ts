type LearningTopic = {
  id: string;
  disciplineId: string;
  status: string;
  mastery: number;
  createdAt: Date;
};

export const topicStatusLabel: Record<string, string> = {
  NAO_ESTUDADO: "Ainda não iniciado",
  ESTUDANDO: "Em andamento",
  REVISAR: "Hora de revisar",
  DOMINADO: "Dominado",
};

export function pickNextTopic<T extends LearningTopic>(items: T[], dueTopicIds: string[] = []) {
  const ordered = [...items].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return ordered.find((topic) => dueTopicIds.includes(topic.id))
    ?? ordered.find((topic) => topic.status === "REVISAR")
    ?? ordered.find((topic) => topic.status === "ESTUDANDO")
    ?? ordered.find((topic) => topic.status === "NAO_ESTUDADO")
    ?? ordered.sort((a, b) => a.mastery - b.mastery)[0];
}

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function learningRhythm(activityDates: Date[]) {
  const activeDays = new Set(activityDates.map(dayKey));
  const today = new Date();
  const todayKey = dayKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  let cursor = activeDays.has(todayKey) ? today : yesterday;
  let streak = 0;
  while (activeDays.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() - 1);
  }
  return { streak, completedToday: activeDays.has(todayKey) };
}
