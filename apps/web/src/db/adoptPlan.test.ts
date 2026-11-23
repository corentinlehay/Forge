import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { nutritionPlan, trainingPlan, type PlanAnswers } from '../domain/plan';
import { adoptPlan, QUESTIONNAIRE_KEY } from './adoptPlan';
import { createProgramRepo, createTemplateRepo } from './repositories/entities';
import { ForgeDB } from './schema';

const dbs: ForgeDB[] = [];
afterEach(async () => {
  for (const db of dbs.splice(0)) {
    db.close();
    await db.delete();
  }
});

const answers: PlanAnswers = {
  goal: 'perte',
  sex: 'female',
  birthDate: '1994-03-02',
  heightCm: 168,
  weightKg: 74.5,
  activity: 'debout',
  experience: 'beginner',
  returning: false,
  weekdays: [1, 3, 5],
  sessionMinutes: 60,
  place: 'maison',
  equipment: ['halteres', 'banc'],
  zones: [],
};
const today = '2026-11-23';

describe('adoption du plan', () => {
  it('enregistre profil, objectifs, pesée, programme actif, sans toucher aux programmes existants', async () => {
    const db = new ForgeDB(`adopt-${crypto.randomUUID()}`);
    dbs.push(db);
    await db.open();
    const programs = createProgramRepo(db);
    const old = await programs.ensureActive();
    const n = nutritionPlan(answers, today);
    if (!n.ok) throw new Error(n.reason);
    const { programId } = await adoptPlan(db, { answers, nutrition: n.plan, training: trainingPlan(answers), today }, new Date('2026-11-23T07:30:00'));

    const profile = await db.profile.get('me');
    expect(profile).toMatchObject({ sex: 'female', heightCm: 168, goal: 'perte', gainRate: { lowPctPerWeek: -1, highPctPerWeek: -0.5 } });
    expect(profile?.nutritionTargets?.kcal).toBe(n.plan.targets.kcal);
    expect(await db.weighIns.where('date').equals(today).count()).toBe(1);

    const all = await programs.listActive();
    expect(all).toHaveLength(2);
    expect(all.find((p) => p.id === old.id)?.active).toBe(false);
    expect(all.find((p) => p.id === programId)?.active).toBe(true);
    const templates = (await createTemplateRepo(db).listActive()).filter((t) => t.programId === programId).sort((a, b) => a.position - b.position);
    expect(templates.map((t) => t.weekdays[0])).toEqual([1, 3, 5]);
    expect(templates[0]!.exercises.length).toBeGreaterThan(2);
    expect(await db.meta.get(QUESTIONNAIRE_KEY)).toBeTruthy();

    // Une seconde adoption le même jour ne double pas la pesée.
    await adoptPlan(db, { answers, nutrition: null, training: null, today });
    expect(await db.weighIns.where('date').equals(today).count()).toBe(1);
  });
});
