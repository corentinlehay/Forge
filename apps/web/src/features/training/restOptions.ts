import { formatRest } from '../../domain/workoutFlow';

export const REST_CHOICES = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

export const restOptions = (current?: number | null) =>
  [...new Set([...REST_CHOICES, ...(current ? [current] : [])])].sort((a, b) => a - b).map((s) => ({ value: String(s), label: formatRest(s) }));
