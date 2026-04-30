export function updateLatestContactActivityDate(
  activityMap: Record<string, string>,
  contactId: string | null | undefined,
  dateValue: string | null | undefined,
  now: Date,
) {
  if (!contactId || !dateValue) return;

  const candidateTime = new Date(dateValue).getTime();
  if (Number.isNaN(candidateTime) || candidateTime > now.getTime()) return;

  const currentValue = activityMap[contactId];
  if (!currentValue) {
    activityMap[contactId] = dateValue;
    return;
  }

  const currentTime = new Date(currentValue).getTime();
  if (Number.isNaN(currentTime) || candidateTime > currentTime) {
    activityMap[contactId] = dateValue;
  }
}
